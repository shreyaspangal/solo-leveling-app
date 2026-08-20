import { redirect } from "next/navigation";
import { NavShell } from "@/components/ui/nav-shell";
import { scheduledOn } from "@/lib/rank-engine/engine";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone, userTimezone } from "@/lib/today";
import { QuestsView } from "./quests-view";

// ADR-007 Phase 10: the reference's Quests view -- tabs (Active/Completed/
// Upcoming), a detail pane, category-wise progress. Was a dead redirect to
// /dashboard since Slice 4 folded the old placeholder there; that redirect
// is gone now that this route has real content of its own. NavShell's
// "Quests" nav item was updated to point here instead of /quests/new
// (still reachable from here via the "New Quest" action).
//
// "Completed"/"Upcoming"/"Active" bucketing (audit: milestone-scoring
// addendum, CLAUDE.md 2026-08-20) deliberately does NOT use a per-goal
// percentage -- that concept doesn't exist yet (milestones don't feed
// personalDevelopmentScore, and there's no per-goal streak function; ADR-001
// avoids per-domain/per-goal progress functions on purpose). Bucketing uses
// only fields the schema already has a real meaning for: startDate for
// upcoming, and "every milestone on this goal is done" for completed -- a
// goal with no milestones can never land in Completed here, which is
// correct for an open-ended daily habit with no finish line, not a gap.
export default async function QuestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = todayInTimezone(userTimezone(user));

  const { data: goalRows } = await supabase
    .from("goals")
    .select("id, title, description, category, frequency, daily_tracking, start_date, target_date")
    .eq("domain", "quest")
    .order("created_at", { ascending: true });

  const goalIds = (goalRows ?? []).map((g) => g.id);

  const [{ data: milestoneRows }, { data: entryRows }] = await Promise.all([
    goalIds.length > 0
      ? supabase
          .from("milestones")
          .select("id, goal_id, title, completed, order")
          .in("goal_id", goalIds)
          .order("order", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
    goalIds.length > 0
      ? supabase.from("goal_entries").select("goal_id, completed").eq("date", today).in("goal_id", goalIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const completedTodayIds = new Set(
    (entryRows ?? []).filter((e) => e.completed).map((e) => e.goal_id),
  );

  const milestonesByGoal = new Map<
    string,
    { id: string; title: string; completed: boolean; order: number }[]
  >();
  for (const m of milestoneRows ?? []) {
    const list = milestonesByGoal.get(m.goal_id) ?? [];
    list.push({ id: m.id, title: m.title, completed: m.completed, order: m.order });
    milestonesByGoal.set(m.goal_id, list);
  }

  const quests = (goalRows ?? []).map((row) => {
    const goal = {
      id: row.id,
      frequency: row.frequency,
      startDate: row.start_date,
      targetDate: row.target_date,
      dailyTracking: row.daily_tracking,
      // Only field scheduledOn actually needs beyond the above; domain is
      // fixed "quest" for every row this query returns.
      domain: "quest" as const,
    };
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      dailyTracking: row.daily_tracking,
      startDate: row.start_date,
      targetDate: row.target_date,
      milestones: milestonesByGoal.get(row.id) ?? [],
      dueToday: row.daily_tracking && scheduledOn(goal, today),
      doneToday: completedTodayIds.has(row.id),
    };
  });

  return (
    <NavShell>
      <QuestsView quests={quests} today={today} />
    </NavShell>
  );
}
