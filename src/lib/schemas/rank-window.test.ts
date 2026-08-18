import { describe, expect, it } from "vitest";
import {
  createRankWindowSchema,
  rankSchema,
  rankTargetSchema,
  rankWindowSchema,
  startPauseSchema,
} from "./rank-window";

function validWindow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "11111111-1111-1111-8111-111111111111",
    userId: "22222222-2222-2222-8222-222222222222",
    rankTarget: "D",
    windowStart: "2026-01-01",
    graceUsed: 0,
    pausedFrom: null,
    pausedUntil: null,
    pauseUsed: false,
    ...overrides,
  };
}

describe("rankSchema vs rankTargetSchema (audit S3 regression guard)", () => {
  it("rankSchema accepts the full E-S domain", () => {
    for (const r of ["E", "D", "C", "B", "A", "S"]) {
      expect(rankSchema.safeParse(r).success).toBe(true);
    }
  });

  it("rankTargetSchema rejects E -- matches the DB check constraint on rank_target exactly", () => {
    expect(rankTargetSchema.safeParse("E").success).toBe(false);
  });

  it("rankTargetSchema accepts D-S", () => {
    for (const r of ["D", "C", "B", "A", "S"]) {
      expect(rankTargetSchema.safeParse(r).success).toBe(true);
    }
  });
});

describe("rankWindowSchema", () => {
  it("accepts a fresh, never-paused window", () => {
    expect(rankWindowSchema.safeParse(validWindow()).success).toBe(true);
  });

  it("rejects rankTarget: 'E' on the window itself (would divide by zero in rankProgress)", () => {
    expect(rankWindowSchema.safeParse(validWindow({ rankTarget: "E" })).success).toBe(false);
  });

  it("rejects graceUsed above 2", () => {
    expect(rankWindowSchema.safeParse(validWindow({ graceUsed: 3 })).success).toBe(false);
  });

  it("accepts a fully-paused window with both dates set", () => {
    const result = rankWindowSchema.safeParse(
      validWindow({ pausedFrom: "2026-01-10", pausedUntil: "2026-01-16", pauseUsed: true }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects pausedFrom set with pausedUntil null (paired-null refinement)", () => {
    const result = rankWindowSchema.safeParse(
      validWindow({ pausedFrom: "2026-01-10", pausedUntil: null }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects pausedUntil set with pausedFrom null (paired-null refinement)", () => {
    const result = rankWindowSchema.safeParse(
      validWindow({ pausedFrom: null, pausedUntil: "2026-01-16" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects pausedUntil before pausedFrom", () => {
    const result = rankWindowSchema.safeParse(
      validWindow({ pausedFrom: "2026-01-16", pausedUntil: "2026-01-10" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["pausedUntil"]);
    }
  });

  it("accepts pausedUntil equal to pausedFrom (a 1-day pause, boundary)", () => {
    const result = rankWindowSchema.safeParse(
      validWindow({ pausedFrom: "2026-01-10", pausedUntil: "2026-01-10", pauseUsed: true }),
    );
    expect(result.success).toBe(true);
  });
});

describe("createRankWindowSchema", () => {
  it("defaults rankTarget to D -- E -> D is always the first climb", () => {
    const result = createRankWindowSchema.safeParse({
      userId: "22222222-2222-2222-8222-222222222222",
      windowStart: "2026-01-01",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rankTarget).toBe("D");
    }
  });

  it("rejects an explicit rankTarget of E", () => {
    const result = createRankWindowSchema.safeParse({
      userId: "22222222-2222-2222-8222-222222222222",
      rankTarget: "E",
      windowStart: "2026-01-01",
    });
    expect(result.success).toBe(false);
  });
});

describe("startPauseSchema", () => {
  it("accepts the boundary values 1 and 7", () => {
    expect(startPauseSchema.safeParse({ days: 1 }).success).toBe(true);
    expect(startPauseSchema.safeParse({ days: 7 }).success).toBe(true);
  });

  it("rejects 0 and 8", () => {
    expect(startPauseSchema.safeParse({ days: 0 }).success).toBe(false);
    expect(startPauseSchema.safeParse({ days: 8 }).success).toBe(false);
  });

  it("rejects a non-integer", () => {
    expect(startPauseSchema.safeParse({ days: 3.5 }).success).toBe(false);
  });
});
