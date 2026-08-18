import { describe, expect, it } from "vitest";
import {
  createGoalEntrySchema,
  createGoalSchema,
  createMilestoneSchema,
  domainSchema,
  frequencySchema,
  goalEntrySchema,
  goalSchema,
  milestoneSchema,
} from "./goal";

// Valid base fixture -- individual tests override just the field under test.
function validGoal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "11111111-1111-1111-8111-111111111111",
    userId: "22222222-2222-2222-8222-222222222222",
    domain: "quest",
    title: "Read every day",
    description: null,
    category: "reading",
    frequency: "daily",
    dailyTracking: true,
    startDate: "2026-01-01",
    targetDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("domainSchema", () => {
  it("accepts the three domains this engine supports", () => {
    for (const domain of ["quest", "spirituality", "learning"]) {
      expect(domainSchema.safeParse(domain).success).toBe(true);
    }
  });

  it("rejects Finance/Fitness -- deferred to ADR-004/005, structurally out of scope here", () => {
    expect(domainSchema.safeParse("finance").success).toBe(false);
    expect(domainSchema.safeParse("fitness").success).toBe(false);
  });
});

describe("frequencySchema", () => {
  it("accepts all four cadences", () => {
    for (const f of ["daily", "weekly", "monthly", "custom"]) {
      expect(frequencySchema.safeParse(f).success).toBe(true);
    }
  });
});

describe("goalSchema", () => {
  it("accepts a valid goal with no targetDate", () => {
    expect(goalSchema.safeParse(validGoal()).success).toBe(true);
  });

  it("accepts targetDate equal to startDate (boundary)", () => {
    const result = goalSchema.safeParse(
      validGoal({ startDate: "2026-01-01", targetDate: "2026-01-01" }),
    );
    expect(result.success).toBe(true);
  });

  it("accepts targetDate after startDate", () => {
    const result = goalSchema.safeParse(
      validGoal({ startDate: "2026-01-01", targetDate: "2026-06-01" }),
    );
    expect(result.success).toBe(true);
  });

  it("rejects targetDate before startDate", () => {
    const result = goalSchema.safeParse(
      validGoal({ startDate: "2026-06-01", targetDate: "2026-01-01" }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["targetDate"]);
    }
  });

  it("rejects free-text category shorter than 1 char, but does not restrict its values", () => {
    expect(goalSchema.safeParse(validGoal({ category: "" })).success).toBe(false);
    // Free text by design (ADR-001) -- anything non-empty within length is fine,
    // not just the onboarding-suggested seed categories.
    expect(goalSchema.safeParse(validGoal({ category: "made-up-category" })).success).toBe(
      true,
    );
  });
});

describe("createGoalSchema", () => {
  it("omits id/userId/createdAt/updatedAt but still enforces targetDate >= startDate", () => {
    const input = validGoal({ startDate: "2026-06-01", targetDate: "2026-01-01" });
    delete (input as Record<string, unknown>).id;
    delete (input as Record<string, unknown>).userId;
    delete (input as Record<string, unknown>).createdAt;
    delete (input as Record<string, unknown>).updatedAt;
    expect(createGoalSchema.safeParse(input).success).toBe(false);
  });

  it("accepts a well-formed create input", () => {
    const input = validGoal({ targetDate: "2026-12-31" });
    delete (input as Record<string, unknown>).id;
    delete (input as Record<string, unknown>).userId;
    delete (input as Record<string, unknown>).createdAt;
    delete (input as Record<string, unknown>).updatedAt;
    expect(createGoalSchema.safeParse(input).success).toBe(true);
  });
});

describe("goalEntrySchema / createGoalEntrySchema", () => {
  const validEntry = {
    id: "33333333-3333-3333-8333-333333333333",
    goalId: "11111111-1111-1111-8111-111111111111",
    date: "2026-01-05",
    completed: true,
    createdAt: "2026-01-05T00:00:00.000Z",
  };

  it("accepts a valid entry", () => {
    expect(goalEntrySchema.safeParse(validEntry).success).toBe(true);
  });

  it("rejects a malformed date", () => {
    expect(goalEntrySchema.safeParse({ ...validEntry, date: "01/05/2026" }).success).toBe(
      false,
    );
  });

  it("createGoalEntrySchema omits id/createdAt", () => {
    const input = {
      goalId: validEntry.goalId,
      date: validEntry.date,
      completed: validEntry.completed,
    };
    expect(createGoalEntrySchema.safeParse(input).success).toBe(true);
  });
});

describe("milestoneSchema / createMilestoneSchema", () => {
  it("accepts a valid milestone", () => {
    expect(
      milestoneSchema.safeParse({
        id: "44444444-4444-4444-8444-444444444444",
        goalId: "11111111-1111-1111-8111-111111111111",
        title: "First checkpoint",
        completed: false,
        order: 0,
      }).success,
    ).toBe(true);
  });

  it("rejects a negative order", () => {
    expect(
      milestoneSchema.safeParse({
        id: "44444444-4444-4444-8444-444444444444",
        goalId: "11111111-1111-1111-8111-111111111111",
        title: "First checkpoint",
        completed: false,
        order: -1,
      }).success,
    ).toBe(false);
  });

  it("createMilestoneSchema omits id", () => {
    expect(
      createMilestoneSchema.safeParse({
        goalId: "11111111-1111-1111-8111-111111111111",
        title: "First checkpoint",
        completed: false,
        order: 0,
      }).success,
    ).toBe(true);
  });
});
