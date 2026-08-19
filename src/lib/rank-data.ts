import type { Goal, GoalEntry, RankWindow } from "./rank-engine/types";
import type { createClient } from "./supabase/server";

export interface RankData {
  goals: Goal[];
  entries: GoalEntry[];
  window: RankWindow | null;
}

// Fetches everything the rank engine (ADR-002) needs for the signed-in
// user, scoped per SC1's guardrail: entries are bounded to
// `>= window.window_start`, never "pull all entries for the user."
// Deliberately outside rank-engine/ -- that module stays pure/DB-agnostic
// (its own header comment); this is the Supabase-specific glue the engine's
// design assumes some caller provides.
//
// No explicit `user_id` filter anywhere below: every table here (goals,
// rank_windows, goal_entries via its join-through policy) is RLS-scoped to
// `auth.uid()` (ADR-003), matching the read pattern Slices 1/2 already
// established -- RLS is the actual boundary for reads, not re-implemented
// at the app layer. `rank_windows`' `unique(user_id)` means an unscoped
// select already returns at most one row: the caller's own.
export async function getRankData(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<RankData> {
  const { data: windowRow } = await supabase
    .from("rank_windows")
    .select("rank_target, window_start, grace_used, paused_from, paused_until, pause_used")
    .maybeSingle();

  const window: RankWindow | null = windowRow
    ? {
        rankTarget: windowRow.rank_target,
        windowStart: windowRow.window_start,
        graceUsed: windowRow.grace_used,
        pausedFrom: windowRow.paused_from,
        pausedUntil: windowRow.paused_until,
        pauseUsed: windowRow.pause_used,
      }
    : null;

  // Rank/streak span all three domains together by design -- ADR-001's
  // "engine is collapsed, not five separate systems," domain is
  // onboarding/display only. Deliberately NO domain filter here, unlike
  // /quests's Quests-only checklist (audit finding P2-2 was specifically
  // about that page needing one; this one must not have it).
  const { data: goalRows } = await supabase
    .from("goals")
    .select("id, domain, frequency, start_date, target_date, daily_tracking");

  const goals: Goal[] = (goalRows ?? []).map((row) => ({
    id: row.id,
    domain: row.domain,
    frequency: row.frequency,
    startDate: row.start_date,
    targetDate: row.target_date,
    dailyTracking: row.daily_tracking,
  }));

  // No window yet (setup never completed) or no goals yet -- nothing to
  // fetch entries for. Also the SC1 scoping boundary itself: without a
  // window there is no window_start to bound the entries query by.
  if (!window || goals.length === 0) {
    return { goals, entries: [], window };
  }

  const goalIds = goals.map((g) => g.id);
  const { data: entryRows } = await supabase
    .from("goal_entries")
    .select("goal_id, date, completed")
    .in("goal_id", goalIds)
    .gte("date", window.windowStart);

  const entries: GoalEntry[] = (entryRows ?? []).map((row) => ({
    goalId: row.goal_id,
    date: row.date,
    completed: row.completed,
  }));

  return { goals, entries, window };
}
