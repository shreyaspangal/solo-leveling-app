import Link from "next/link";
import { redirect } from "next/navigation";
import { scheduledOn } from "@/lib/rank-engine/engine";
import type { Goal } from "@/lib/rank-engine/types";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone, userTimezone } from "@/lib/today";
import { TodayChecklist } from "./today-checklist";

// Phase 1 slice 2: today's-quests checklist -- the "track" step of the
// vertical slice (create -> track -> streak -> rank contribution). Streak/
// rank display is Slice 3/4 work; this page only writes GoalEntry rows.
export default async function QuestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = todayInTimezone(userTimezone(user));

  // Selecting only the columns scheduledOn/the checklist actually need,
  // not `select("*")` -- SC1/SC3's guardrail about scoping fetches applies
  // to column selection too, not just date ranges.
  //
  // domain filter (audit finding P2-2): this page is Quests-specific --
  // ADR-001 designs Spirituality/Learning as the same entity differing only
  // by onboarding template, so without this filter, once Phase 2 adds those
  // domains their goals would silently appear in the Quests checklist too.
  const { data: goalRows } = await supabase
    .from("goals")
    .select("id, domain, title, category, frequency, start_date, target_date, daily_tracking")
    .eq("domain", "quest")
    .order("created_at", { ascending: true });

  const goals: (Goal & { title: string; category: string; dailyTracking: boolean })[] = (
    goalRows ?? []
  ).map((row) => ({
    id: row.id,
    domain: row.domain,
    title: row.title,
    category: row.category,
    frequency: row.frequency,
    startDate: row.start_date,
    targetDate: row.target_date,
    dailyTracking: row.daily_tracking,
  }));

  // daily_tracking filter (audit finding P2-1): ADR-001 is explicit --
  // "if false, goal is tracked as overall % only, no per-day checklist."
  // This is the daily checklist, so a goal opted out of daily tracking
  // never belongs on it, regardless of whether it's otherwise scheduledOn
  // today. (What a daily_tracking=false goal contributes to dailyCompletion
  // itself is decided in ADR-002's addendum, ahead of Slice 3's engine
  // wiring -- this page doesn't touch that calculation at all yet.)
  const scheduledToday = goals.filter((goal) => goal.dailyTracking && scheduledOn(goal, today));

  const { data: entryRows } = await supabase
    .from("goal_entries")
    .select("goal_id, completed")
    .eq("date", today);

  const completedGoalIds = new Set(
    (entryRows ?? []).filter((e) => e.completed).map((e) => e.goal_id),
  );

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s Quests</h1>
        <p className="mt-2 text-sm text-zinc-500">{today}</p>

        {scheduledToday.length === 0 ? (
          <p className="mt-6 text-sm text-zinc-500">
            Nothing scheduled today.{" "}
            <Link href="/quests/new" className="font-medium text-foreground underline">
              Create a quest
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <TodayChecklist
            goals={scheduledToday.map((g) => ({
              id: g.id,
              title: g.title,
              category: g.category,
              completed: completedGoalIds.has(g.id),
            }))}
          />
        )}

        <Link
          href="/quests/new"
          className="mt-6 flex h-11 items-center justify-center rounded-full border border-zinc-300 px-5 font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Create a Quest
        </Link>
      </div>
    </div>
  );
}
