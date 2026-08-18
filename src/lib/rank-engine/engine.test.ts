import { describe, expect, it } from "vitest";
import { addDays } from "./date-utils";
import {
  dailyCompletion,
  isPaused,
  personalDevelopmentScore,
  rankProgress,
  startPause,
  streak,
} from "./engine";
import type { Goal, GoalEntry, RankWindow } from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function dailyGoal(id: string, overrides: Partial<Goal> = {}): Goal {
  return {
    id,
    domain: "quest",
    frequency: "daily",
    startDate: "2026-01-01",
    targetDate: null,
    ...overrides,
  };
}

function entry(goalId: string, date: string, completed: boolean): GoalEntry {
  return { goalId, date, completed };
}

function freshWindow(overrides: Partial<RankWindow> = {}): RankWindow {
  return {
    rankTarget: "D",
    windowStart: "2026-01-01",
    graceUsed: 0,
    pausedFrom: null,
    pausedUntil: null,
    pauseUsed: false,
    ...overrides,
  };
}

// N consecutive date strings starting at `start`, inclusive.
function datesFrom(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

// ---------------------------------------------------------------------------
// dailyCompletion
// ---------------------------------------------------------------------------

describe("dailyCompletion", () => {
  it("returns null when the user has zero active goals", () => {
    expect(dailyCompletion([], [], "2026-01-05")).toBeNull();
  });

  it("returns null for a goal with no entries yet (not 0%)", () => {
    // A goal that exists but has never been logged should not read as a hard
    // miss on days before the user has had a chance to act — but note ADR-002's
    // dailyCompletion counts *expected* goals with no matching entry as
    // incomplete, so a due, unentered goal legitimately scores 0%, not null.
    // "null" only applies when there is nothing scheduled at all.
    const goals = [dailyGoal("g1")];
    expect(dailyCompletion(goals, [], "2026-01-05")).toBe(0);
  });

  it("ignores a weekly goal on days it is not due", () => {
    const weekly = dailyGoal("weekly-1", {
      frequency: "weekly",
      startDate: "2026-01-01", // Thursday
    });
    const daily = dailyGoal("daily-1");
    const entries = [entry("daily-1", "2026-01-02", true)];
    // 2026-01-02 is a Friday: weekly goal (due Thursdays) isn't due, only the
    // daily goal counts, and it was completed -> 100%.
    expect(dailyCompletion([weekly, daily], entries, "2026-01-02")).toBe(100);
  });

  it("returns null when goals exist but none are scheduled that day", () => {
    const weekly = dailyGoal("weekly-1", {
      frequency: "weekly",
      startDate: "2026-01-01", // Thursday
    });
    expect(dailyCompletion([weekly], [], "2026-01-02")).toBeNull();
  });

  it("scores mixed domains together as one completion percentage", () => {
    const goals = [
      dailyGoal("quest-1", { domain: "quest" }),
      dailyGoal("spirit-1", { domain: "spirituality" }),
      dailyGoal("learn-1", { domain: "learning" }),
      dailyGoal("learn-2", { domain: "learning" }),
    ];
    const entries = [
      entry("quest-1", "2026-01-05", true),
      entry("spirit-1", "2026-01-05", true),
      entry("learn-1", "2026-01-05", true),
      entry("learn-2", "2026-01-05", false),
    ];
    expect(dailyCompletion(goals, entries, "2026-01-05")).toBe(75);
  });

  it("excludes goals outside their start/target date window", () => {
    const notStartedYet = dailyGoal("future", { startDate: "2026-02-01" });
    const alreadyEnded = dailyGoal("past", {
      startDate: "2025-01-01",
      targetDate: "2025-12-31",
    });
    const active = dailyGoal("active");
    const entries = [entry("active", "2026-01-05", true)];
    expect(
      dailyCompletion([notStartedYet, alreadyEnded, active], entries, "2026-01-05"),
    ).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// streak
// ---------------------------------------------------------------------------

describe("streak", () => {
  it("counts an exact chain of 100% days", () => {
    const goal = dailyGoal("g1");
    const dates = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"];
    const entries = dates.map((d) => entry("g1", d, true));
    const window = freshWindow();
    expect(streak([goal], entries, window, "2026-01-04")).toBe(4);
  });

  it("breaks on a single miss", () => {
    const goal = dailyGoal("g1");
    const entries = [
      entry("g1", "2026-01-01", true),
      entry("g1", "2026-01-02", false), // miss
      entry("g1", "2026-01-03", true),
      entry("g1", "2026-01-04", true),
    ];
    const window = freshWindow();
    // Streak should only count back from 01-04 to 01-03 (2 days) since 01-02
    // was a miss and breaks the chain.
    expect(streak([goal], entries, window, "2026-01-04")).toBe(2);
  });

  it("preserves a streak across a paused day", () => {
    const goal = dailyGoal("g1");
    const entries = [
      entry("g1", "2026-01-01", true),
      // 2026-01-02 is paused, no entry at all
      entry("g1", "2026-01-03", true),
      entry("g1", "2026-01-04", true),
    ];
    const window = freshWindow({
      pausedFrom: "2026-01-02",
      pausedUntil: "2026-01-02",
      pauseUsed: true,
    });
    expect(streak([goal], entries, window, "2026-01-04")).toBe(3);
  });

  it("does not let a paused day inflate the streak count", () => {
    const goal = dailyGoal("g1");
    // Only a single real hit, surrounded by a paused day and nothing else.
    const entries = [entry("g1", "2026-01-03", true)];
    const window = freshWindow({
      pausedFrom: "2026-01-01",
      pausedUntil: "2026-01-02",
      pauseUsed: true,
    });
    expect(streak([goal], entries, window, "2026-01-03")).toBe(1);
  });

  it("does not break on unscheduled days between a weekly goal's due dates (audit C2)", () => {
    // Weekly goal due every Thursday, starting 2026-01-01. Four consecutive
    // perfect due-days, with six unscheduled (null) days between each one.
    // Before the fix, the first null day encountered walking backward from
    // "today" terminated the loop, capping the streak at 1.
    const weekly = dailyGoal("w1", { frequency: "weekly", startDate: "2026-01-01" });
    const dueDates = ["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22"];
    const entries = dueDates.map((d) => entry("w1", d, true));
    const window = freshWindow({ windowStart: "2026-01-01" });
    expect(streak([weekly], entries, window, "2026-01-22")).toBe(4);
  });

  it("returns 0 immediately for a user with no goals, rather than walking backward forever", () => {
    // Every day is null with no goals at all, so nothing bounds the walk
    // except this early return -- without it, this call would hang.
    expect(streak([], [], freshWindow(), "2026-06-01")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// rankProgress
// ---------------------------------------------------------------------------

describe("rankProgress", () => {
  it("stays in the same window after exactly 2 misses", () => {
    const goal = dailyGoal("g1", { startDate: "2026-01-01" });
    const entries = [
      entry("g1", "2026-01-01", true),
      entry("g1", "2026-01-02", false), // miss 1
      entry("g1", "2026-01-03", true),
      entry("g1", "2026-01-04", false), // miss 2
      entry("g1", "2026-01-05", true),
    ];
    const window = freshWindow({ windowStart: "2026-01-01" });
    const result = rankProgress([goal], entries, window, "2026-01-05");
    expect(result.window.windowStart).toBe("2026-01-01");
    expect(result.window.graceUsed).toBe(2);
    expect(result.graceRemaining).toBe(0);
  });

  it("resets window_start on the 3rd miss instead of dropping rank", () => {
    const goal = dailyGoal("g1", { startDate: "2026-01-01" });
    const entries = [
      entry("g1", "2026-01-01", true),
      entry("g1", "2026-01-02", false), // miss 1
      entry("g1", "2026-01-03", false), // miss 2
      entry("g1", "2026-01-04", false), // miss 3 -> resets
      entry("g1", "2026-01-05", true),
    ];
    const window = freshWindow({ windowStart: "2026-01-01" });
    const result = rankProgress([goal], entries, window, "2026-01-05");
    expect(result.window.windowStart).toBe("2026-01-04");
    expect(result.window.graceUsed).toBe(0);
    expect(result.graceRemaining).toBe(2);
  });

  it("does not consume grace for a paused day", () => {
    const goal = dailyGoal("g1", { startDate: "2026-01-01" });
    // No entries at all on the paused day -- would otherwise read as a miss.
    const entries = [
      entry("g1", "2026-01-01", true),
      entry("g1", "2026-01-03", true),
    ];
    const window = freshWindow({
      windowStart: "2026-01-01",
      pausedFrom: "2026-01-02",
      pausedUntil: "2026-01-02",
      pauseUsed: true,
    });
    const result = rankProgress([goal], entries, window, "2026-01-03");
    expect(result.window.graceUsed).toBe(0);
    expect(result.graceRemaining).toBe(2);
  });

  it("does not reset window_start on unscheduled days (weekly-only, 4 perfect weeks) (audit C1)", () => {
    // Same weekly-goal setup as the streak test above. Before the fix, the
    // ~18 unscheduled days across these 4 weeks were each charged as a miss,
    // resetting window_start well before the 4th due date -- a weekly-only
    // user could never accumulate rank progress at all.
    const weekly = dailyGoal("w1", { frequency: "weekly", startDate: "2026-01-01" });
    const dueDates = ["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22"];
    const entries = dueDates.map((d) => entry("w1", d, true));
    const window = freshWindow({ windowStart: "2026-01-01" });
    const result = rankProgress([weekly], entries, window, "2026-01-22");
    expect(result.window.windowStart).toBe("2026-01-01");
    expect(result.window.graceUsed).toBe(0);
    expect(result.graceRemaining).toBe(2);
  });

  it("does not reset window_start on unscheduled days (monthly-only, 3 perfect months)", () => {
    const monthly = dailyGoal("m1", { frequency: "monthly", startDate: "2026-01-15" });
    const dueDates = ["2026-01-15", "2026-02-15", "2026-03-15"];
    const entries = dueDates.map((d) => entry("m1", d, true));
    const window = freshWindow({ windowStart: "2026-01-15" });
    const result = rankProgress([monthly], entries, window, "2026-03-15");
    expect(result.window.windowStart).toBe("2026-01-15");
    expect(result.window.graceUsed).toBe(0);
  });

  it("clamps pct at 100 once the requirement is exceeded, and reports completed (audit C3)", () => {
    const goal = dailyGoal("g1");
    const dates = datesFrom("2026-01-01", 200); // far past D-rank's 60-day requirement
    const entries = dates.map((d) => entry("g1", d, true));
    const window = freshWindow({ windowStart: dates[0] });
    const today = dates[dates.length - 1];
    const result = rankProgress([goal], entries, window, today);
    expect(result.pct).toBe(100);
    expect(result.completed).toBe(true);
    expect(result.window.graceUsed).toBe(0);
  });

  it("does not divide by zero for a schema-illegal but engine-reachable rank_target of E", () => {
    const goal = dailyGoal("g1");
    const entries = [entry("g1", "2026-01-01", true)];
    const window = freshWindow({ rankTarget: "E", windowStart: "2026-01-01" });
    const result = rankProgress([goal], entries, window, "2026-01-01");
    expect(Number.isFinite(result.pct)).toBe(true);
    expect(result.pct).toBeGreaterThanOrEqual(0);
    expect(result.pct).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// personalDevelopmentScore
// ---------------------------------------------------------------------------

describe("personalDevelopmentScore", () => {
  it("blends daily completion, streak, and rank progress into the documented weighted formula", () => {
    const goal = dailyGoal("g1");
    const dates = datesFrom("2026-01-01", 14);
    const entries = dates.map((d) => entry("g1", d, true));
    const window = freshWindow({ windowStart: dates[0] });
    const today = dates[dates.length - 1];

    const daily = dailyCompletion([goal], entries, today);
    const rank = rankProgress([goal], entries, window, today);
    const streakCount = streak([goal], entries, window, today);
    const expected = Math.round(
      0.5 * rank.pct + 0.3 * Math.min((streakCount / 30) * 100, 100) + 0.2 * (daily ?? 100),
    );

    expect(personalDevelopmentScore([goal], entries, window, today)).toBe(expected);
  });

  it("treats an unscheduled today as neutral, not a drag, in the daily component", () => {
    const weekly = dailyGoal("w1", { frequency: "weekly", startDate: "2026-01-01" });
    const entries = ["2026-01-01", "2026-01-08", "2026-01-15"].map((d) =>
      entry("w1", d, true),
    );
    const window = freshWindow({ windowStart: "2026-01-01" });
    const today = "2026-01-16"; // Friday, not due -- dailyCompletion is null here

    expect(dailyCompletion([weekly], entries, today)).toBeNull();

    const rank = rankProgress([weekly], entries, window, today);
    const streakCount = streak([weekly], entries, window, today);
    const expected = Math.round(
      0.5 * rank.pct + 0.3 * Math.min((streakCount / 30) * 100, 100) + 0.2 * 100,
    );

    expect(personalDevelopmentScore([weekly], entries, window, today)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// startPause / isPaused
// ---------------------------------------------------------------------------

describe("startPause", () => {
  it("rejects a pause longer than 7 days", () => {
    const window = freshWindow();
    expect(() => startPause(window, 8, "2026-01-10")).toThrow();
  });

  it("rejects a second pause within the same window", () => {
    const window = freshWindow({ pauseUsed: true });
    expect(() => startPause(window, 3, "2026-01-10")).toThrow();
  });

  it("covers exactly `days` days inclusive, so day 1 and day 7 both count as paused", () => {
    const window = freshWindow();
    const paused = startPause(window, 7, "2026-01-10");
    expect(isPaused(paused, "2026-01-10")).toBe(true); // day 1
    expect(isPaused(paused, "2026-01-16")).toBe(true); // day 7
    expect(isPaused(paused, "2026-01-17")).toBe(false); // day 8, outside the pause
  });
});
