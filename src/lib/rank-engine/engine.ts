// Rank / streak / pause calculation engine — ADR-002.
//
// Deliberately pure and DB-agnostic: callers fetch the relevant Goal/GoalEntry
// rows and the user's current RankWindow, then hand them to these functions.
// Keeping persistence out of this module is what makes ADR-002's test surface
// testable without a live database, and keeps the streak "always recomputable
// from raw entries" per ADR-001's rationale for not storing running counters.

import { addDays, dayOfMonth, dayOfWeek } from "./date-utils";
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

// Goals active on `date` (started, not yet past their targetDate, and
// daily-tracked). Shared by dailyCompletion, streak, and rankProgress --
// audit finding C4 was exactly this predicate drifting out of sync between
// callers (rankProgress checked completion === null instead of asking this
// directly, conflating "no active goals" with "goals active but nothing
// due"). The dailyTracking condition is ADR-002's addendum (2026-08-19,
// audit finding P2-1): ADR-001 says a daily_tracking=false goal is "tracked
// as overall % only, no per-day checklist" -- that means no per-day
// scoring either, so it's excluded from the whole engine at this one choke
// point, the same way expired/not-yet-started goals already are.
function activeGoalsOn(goals: Goal[], date: string): Goal[] {
  return goals.filter(
    (g) =>
      g.startDate <= date && (g.targetDate === null || g.targetDate >= date) && g.dailyTracking,
  );
}

// Shared scoring core: given the goals expected today and the entries that
// apply to exactly that date (however they were sourced -- a flat filter
// for a single-date query, or an indexed lookup inside a multi-day loop),
// compute the percentage. Keeping this separate from both dailyCompletion
// and the indexed loop path is what lets SC3's fix (below) avoid
// duplicating the actual scoring logic, not just the entries lookup.
function completionFor(expected: Goal[], entriesOnDate: GoalEntry[]): number {
  const expectedIds = new Set(expected.map((g) => g.id));
  const completed = entriesOnDate.filter(
    (e) => expectedIds.has(e.goalId) && e.completed,
  ).length;
  return Math.round((completed / expected.length) * 100);
}

export function dailyCompletion(
  goals: Goal[],
  entries: GoalEntry[],
  date: string,
): number | null {
  const activeGoals = activeGoalsOn(goals, date);
  if (activeGoals.length === 0) return null;

  const expected = activeGoals.filter((g) => scheduledOn(g, date));
  if (expected.length === 0) return null; // nothing due today = no score, not 0%

  const entriesOnDate = entries.filter((e) => e.date === date);
  return completionFor(expected, entriesOnDate);
}

// SC3: streak/rankProgress walk up to 730 days, and dailyCompletion's flat
// `entries.filter(e => e.date === date)` re-scans the ENTIRE entries array
// on every single day of that walk -- O(days x goals x entries). Indexing
// once per call (O(entries)) and doing an O(1) map lookup per day instead
// turns the entries side of the cost into O(entries) total, not
// O(days x entries). The `activeGoals`/`scheduledOn` side of the cost stays
// a fresh O(goals) filter per day -- goal counts are small (SC3's own
// estimate: "3 daily goals"), so that part was never the actual blowup and
// doesn't need indexing.
function indexEntriesByDate(entries: GoalEntry[]): Map<string, GoalEntry[]> {
  const byDate = new Map<string, GoalEntry[]>();
  for (const e of entries) {
    const forDate = byDate.get(e.date);
    if (forDate) {
      forDate.push(e);
    } else {
      byDate.set(e.date, [e]);
    }
  }
  return byDate;
}

function dailyCompletionIndexed(
  goals: Goal[],
  entriesByDate: Map<string, GoalEntry[]>,
  date: string,
): number | null {
  const activeGoals = activeGoalsOn(goals, date);
  if (activeGoals.length === 0) return null;

  const expected = activeGoals.filter((g) => scheduledOn(g, date));
  if (expected.length === 0) return null;

  return completionFor(expected, entriesByDate.get(date) ?? []);
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
  if (goals.length === 0) return 0;

  // Nothing before the earliest goal's start date was ever scheduled or
  // unscheduled in any meaningful sense -- dailyCompletion is null for all
  // of it for the same structural reason. Used as the walk's lower bound
  // below: without it, a null day no longer terminates the loop (see ADR-002
  // addendum), so an all-unscheduled history would walk backward forever.
  const earliestGoalStart = goals.reduce(
    (min, g) => (g.startDate < min ? g.startDate : min),
    goals[0].startDate,
  );

  // SC3: index once, not per day of the walk -- see indexEntriesByDate's
  // own comment.
  const entriesByDate = indexEntriesByDate(entries);

  let check = uptoDate;
  if (dailyCompletionIndexed(goals, entriesByDate, uptoDate) !== 100) {
    check = addDays(check, -1);
  }

  let n = 0;
  while (check >= earliestGoalStart) {
    if (isPaused(window, check)) {
      check = addDays(check, -1);
      continue;
    }
    if (activeGoalsOn(goals, check).length === 0) {
      // No active goals at all that day -- not a rest day (goals exist,
      // just not due), a day with nothing to be consistent about. Breaks
      // the chain rather than being skipped like a genuinely unscheduled
      // day: silently walking through a goal-less gap to older history
      // would report a "streak" for a user who hasn't touched the app in
      // months (audit finding C4's counterpart in streak). ADR-002
      // addendum §D.
      break;
    }
    const completion = dailyCompletionIndexed(goals, entriesByDate, check);
    if (completion === null) {
      // Goals active, nothing due today -- neutral, same treatment as a
      // paused day: doesn't extend the streak, doesn't break it either.
      // ADR-002 addendum §A.
      check = addDays(check, -1);
      continue;
    }
    if (completion !== 100) break; // a real miss still ends the streak
    n += 1;
    check = addDays(check, -1);
  }
  return n;
}

export interface RankProgressResult {
  pct: number;
  graceRemaining: number;
  window: RankWindow;
  completed: boolean;
}

export function rankProgress(
  goals: Goal[],
  entries: GoalEntry[],
  window: RankWindow,
  today: string,
): RankProgressResult {
  const w: RankWindow = { ...window };

  // Count of days that actually had an active goal, not raw calendar days
  // since window_start (audit finding C4): a zero-goal or all-goals-expired
  // account was climbing on the calendar alone, since a goal-less day
  // consumed no grace (correctly) but still counted as elapsed (the bug).
  // Reset alongside window_start on a 3rd-miss reset, same as grace.
  // ADR-002 addendum §D.
  let qualifyingDays = 0;

  // SC3: index once, not per day of the walk (up to 730 days for S-rank) --
  // see indexEntriesByDate's own comment.
  const entriesByDate = indexEntriesByDate(entries);

  let date = w.windowStart;
  while (date <= today) {
    if (!isPaused(w, date) && activeGoalsOn(goals, date).length > 0) {
      qualifyingDays += 1;
      const completion = dailyCompletionIndexed(goals, entriesByDate, date);
      // Unscheduled day (goals active, nothing due) -- neutral, same
      // treatment as a paused day: doesn't consume grace. ADR-002 addendum
      // §A. (completion can't be null here -- activeGoalsOn is non-empty --
      // but dailyCompletion can still return null if nothing is due today.)
      if (completion !== null && completion !== 100) {
        w.graceUsed += 1;
        if (w.graceUsed > 2) {
          // 3rd miss restarts the countdown for the *next* rank rather than
          // dropping the user back a rank (ADR-002).
          w.windowStart = date;
          w.graceUsed = 0;
          qualifyingDays = 0;
        }
      }
    }
    date = addDays(date, 1);
  }

  // Floor of 1 guards against RANK_REQUIREMENT_DAYS["E"] (0) dividing by
  // zero -- "E" is schema-illegal as a rank_target (S3) but this is a pure
  // function with no schema in front of it. ADR-002 addendum §B.
  const requiredDays = Math.max(1, RANK_REQUIREMENT_DAYS[w.rankTarget]);
  const pct = Math.min(100, Math.max(0, Math.round((qualifyingDays / requiredDays) * 100)));

  return {
    pct,
    graceRemaining: 2 - w.graceUsed,
    window: w,
    completed: pct >= 100,
  };
}

// Display-layer aggregate for the dashboard's "Overall development score"
// tile (PRD). Deliberately does not feed back into rank_target/grace_used/
// window_start -- a fourth function layered on the other three, never a
// fourth code path recomputing their logic. ADR-002 addendum §C.
const PDS_STREAK_NORMALIZATION_DAYS = 30;
const PDS_WEIGHTS = { rank: 0.5, streak: 0.3, daily: 0.2 };

export function personalDevelopmentScore(
  goals: Goal[],
  entries: GoalEntry[],
  window: RankWindow,
  today: string,
): number {
  const rankComponent = rankProgress(goals, entries, window, today).pct;
  const streakComponent = Math.min(
    (streak(goals, entries, window, today) / PDS_STREAK_NORMALIZATION_DAYS) * 100,
    100,
  );

  // No active goals at all today -- nothing to score for "daily," excluded
  // rather than defaulted to 0 or 100 (audit finding C5, the same
  // dailyCompletion-null conflation C4 fixed in rankProgress/streak, missed
  // here). "?? 100" is correct for goals-active-nothing-due; it isn't for
  // nothing-ever-active. Renormalize over rank+streak instead of guessing a
  // number for a component that has no basis to score. ADR-002 addendum §C.
  if (activeGoalsOn(goals, today).length === 0) {
    const remainingWeight = PDS_WEIGHTS.rank + PDS_WEIGHTS.streak;
    return Math.round(
      (PDS_WEIGHTS.rank * rankComponent + PDS_WEIGHTS.streak * streakComponent) /
        remainingWeight,
    );
  }

  const daily = dailyCompletion(goals, entries, today);
  const dailyComponent = daily ?? 100; // goals active, nothing due -- neutral, not a drag

  return Math.round(
    PDS_WEIGHTS.rank * rankComponent +
      PDS_WEIGHTS.streak * streakComponent +
      PDS_WEIGHTS.daily * dailyComponent,
  );
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
