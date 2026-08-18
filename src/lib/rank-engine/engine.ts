// Rank / streak / pause calculation engine — ADR-002.
//
// Deliberately pure and DB-agnostic: callers fetch the relevant Goal/GoalEntry
// rows and the user's current RankWindow, then hand them to these functions.
// Keeping persistence out of this module is what makes ADR-002's test surface
// testable without a live database, and keeps the streak "always recomputable
// from raw entries" per ADR-001's rationale for not storing running counters.

import { addDays, dayOfMonth, dayOfWeek, daysBetween } from "./date-utils";
import type { Goal, GoalEntry, Rank, RankWindow } from "./types";

// PRD rank-up durations, expressed in days. rank_target is the rank the user
// is currently working *toward* (e.g. "D" means the current window is the
// E->D climb). E has no requirement since nothing climbs toward E.
const RANK_REQUIREMENT_DAYS: Record<Rank, number> = {
  E: 0,
  D: 60, // E -> D: 2 months
  C: 120, // D -> C: 4 months
  B: 240, // C -> B: 8 months
  A: 365, // B -> A: 1 year
  S: 730, // A -> S: 2 years
};

// NOTE: ADR-001's Goal schema only carries `frequency` (daily/weekly/monthly/
// custom) with no explicit cadence detail (no day-of-week, no day-of-month
// field). For weekly/monthly cadence this implementation infers "due" from
// the goal's own start_date (weekly = same weekday as start_date, monthly =
// same day-of-month as start_date). "custom" has no defined cadence at all in
// the schema, so it is treated the same as weekly. This is a gap in ADR-001/
// ADR-002, not a decision made here — flagged for a schema addendum before
// Phase 1 needs weekly/monthly/custom goals to actually work.
export function scheduledOn(goal: Goal, date: string): boolean {
  if (date < goal.startDate) return false;
  if (goal.targetDate !== null && date > goal.targetDate) return false;

  switch (goal.frequency) {
    case "daily":
      return true;
    case "weekly":
    case "custom":
      return dayOfWeek(date) === dayOfWeek(goal.startDate);
    case "monthly":
      return dayOfMonth(date) === dayOfMonth(goal.startDate);
  }
}

export function dailyCompletion(
  goals: Goal[],
  entries: GoalEntry[],
  date: string,
): number | null {
  const activeGoals = goals.filter(
    (g) => g.startDate <= date && (g.targetDate === null || g.targetDate >= date),
  );
  if (activeGoals.length === 0) return null;

  const expected = activeGoals.filter((g) => scheduledOn(g, date));
  if (expected.length === 0) return null; // nothing due today = no score, not 0%

  const expectedIds = new Set(expected.map((g) => g.id));
  const completed = entries.filter(
    (e) => expectedIds.has(e.goalId) && e.date === date && e.completed,
  ).length;

  return Math.round((completed / expected.length) * 100);
}

export function isPaused(window: RankWindow, date: string): boolean {
  if (window.pausedFrom === null || window.pausedUntil === null) return false;
  return window.pausedFrom <= date && date <= window.pausedUntil;
}

export function streak(
  goals: Goal[],
  entries: GoalEntry[],
  window: RankWindow,
  uptoDate: string,
): number {
  let check = uptoDate;
  if (dailyCompletion(goals, entries, uptoDate) !== 100) {
    check = addDays(check, -1);
  }

  let n = 0;
  while (isPaused(window, check) || dailyCompletion(goals, entries, check) === 100) {
    if (isPaused(window, check)) {
      check = addDays(check, -1);
      continue;
    }
    n += 1;
    check = addDays(check, -1);
  }
  return n;
}

export interface RankProgressResult {
  pct: number;
  graceRemaining: number;
  window: RankWindow;
}

export function rankProgress(
  goals: Goal[],
  entries: GoalEntry[],
  window: RankWindow,
  today: string,
): RankProgressResult {
  const w: RankWindow = { ...window };

  let date = w.windowStart;
  while (date <= today) {
    if (!isPaused(w, date)) {
      const completion = dailyCompletion(goals, entries, date);
      if (completion !== 100) {
        w.graceUsed += 1;
        if (w.graceUsed > 2) {
          // 3rd miss restarts the countdown for the *next* rank rather than
          // dropping the user back a rank (ADR-002).
          w.windowStart = date;
          w.graceUsed = 0;
        }
      }
    }
    date = addDays(date, 1);
  }

  const requiredDays = RANK_REQUIREMENT_DAYS[w.rankTarget];
  const elapsed = daysBetween(w.windowStart, today);

  return {
    pct: Math.round((elapsed / requiredDays) * 100),
    graceRemaining: 2 - w.graceUsed,
    window: w,
  };
}

export function startPause(window: RankWindow, days: number, today: string): RankWindow {
  if (days < 1 || days > 7) {
    throw new Error("Pause must be between 1 and 7 days");
  }
  if (window.pauseUsed) {
    throw new Error("Pause already used in this rank window");
  }

  return {
    ...window,
    pausedFrom: today,
    // Inclusive span of exactly `days` days (day 1 == today, day `days` ==
    // today + days - 1), per ADR-002's `startPause` formula.
    pausedUntil: addDays(today, days - 1),
    pauseUsed: true,
  };
}
