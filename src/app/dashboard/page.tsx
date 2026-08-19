import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getRankData } from "@/lib/rank-data";
import { personalDevelopmentScore, rankProgress, scheduledOn, streak } from "@/lib/rank-engine/engine";
import type { Goal } from "@/lib/rank-engine/types";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone, userTimezone } from "@/lib/today";
import { TimezoneSync } from "../timezone-sync";
import { TodayChecklist } from "../quests/today-checklist";

// Phase 1 slice 4: Home Dashboard v1 -- assembles slices 1-3 (goal creation,
// today's checklist, rank engine wiring) into the real dashboard, replacing
// both the old placeholder here and the /quests page it superseded (that
// route now just redirects here; see src/app/quests/page.tsx).
//
// Scope vs. the PRD's full Home Dashboard section: intentionally omits
// "Today's Overview" (per-module breakdown table) and "Module Summaries"
// (per-module cards) -- both describe a multi-domain view, and CLAUDE.md
// scopes Phase 1 to Quests-only ("Full vertical slice on one domain...
// Home Dashboard v1"). With exactly one domain live, either section would
// just repeat the checklist already on this page. The Global Date Filter
// is out of scope for a different reason -- CLAUDE.md defers it to Phase 3,
// after every domain exists, since a consistent completion model to filter
// against doesn't exist yet with only Quests built.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = todayInTimezone(userTimezone(user));

  // Rank/streak/PDS span all domains (ADR-001) -- getRankData deliberately
  // has no domain filter, unlike the Quests-only checklist fetch below. A
  // user who hasn't finished /setup yet has no RankWindow row (ADR-003
  // creates it at the end of setup, not signup), so `window` can
  // legitimately be null here even though normal navigation never reaches
  // /dashboard before setup finishes.
  const rankData = await getRankData(supabase);
  const progress = rankData.window
    ? rankProgress(rankData.goals, rankData.entries, rankData.window, today)
    : null;
  const currentStreak = rankData.window
    ? streak(rankData.goals, rankData.entries, rankData.window, today)
    : null;
  const score = rankData.window
    ? personalDevelopmentScore(rankData.goals, rankData.entries, rankData.window, today)
    : null;

  // Selecting only the columns scheduledOn/the checklist actually need, not
  // `select("*")` -- SC1/SC3's guardrail about scoping fetches applies to
  // column selection too, not just date ranges.
  //
  // domain filter (audit finding P2-2): this page's checklist is
  // Quests-specific -- ADR-001 designs Spirituality/Learning as the same
  // entity differing only by onboarding template, so without this filter,
  // once Phase 2 adds those domains their goals would silently appear in
  // the Quests checklist too.
  const { data: goalRows } = await supabase
    .from("goals")
    .select("id, domain, title, category, frequency, start_date, target_date, daily_tracking")
    .eq("domain", "quest")
    .order("created_at", { ascending: true });

  const goals: (Goal & { title: string; category: string })[] = (goalRows ?? []).map((row) => ({
    id: row.id,
    domain: row.domain,
    title: row.title,
    category: row.category,
    frequency: row.frequency,
    startDate: row.start_date,
    targetDate: row.target_date,
    dailyTracking: row.daily_tracking,
  }));

  // daily_tracking filter (audit finding P2-1): ADR-001 is explicit -- "if
  // false, goal is tracked as overall % only, no per-day checklist." This
  // is the daily checklist, so a goal opted out of daily tracking never
  // belongs on it, regardless of whether it's otherwise scheduledOn today.
  const scheduledToday = goals.filter((goal) => goal.dailyTracking && scheduledOn(goal, today));

  // Minimal visibility for daily_tracking=false goals (project owner
  // decision, 2026-08-19, follow-up to audit finding P2-1): these are
  // correctly excluded from the daily checklist above and from the whole
  // rank engine (ADR-002 addendum) -- but without this list a user who
  // created one would have no way to see it existed anywhere. Not the
  // "overall %" tracking ADR-001 gestures at (that's still undecided, still
  // out of scope) -- just a plain list, so the goal isn't invisible.
  const overallGoals = goals.filter(
    (goal) =>
      !goal.dailyTracking &&
      goal.startDate <= today &&
      (goal.targetDate === null || goal.targetDate >= today),
  );

  const { data: entryRows } = await supabase
    .from("goal_entries")
    .select("goal_id, completed")
    .eq("date", today);

  const completedGoalIds = new Set(
    (entryRows ?? []).filter((e) => e.completed).map((e) => e.goal_id),
  );

  return (
    <div className="flex flex-1 flex-col items-center px-6 py-16">
      <TimezoneSync />
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">{today}</p>

        {/* Rank isn't Quests-specific (ADR-001), unlike the checklist below --
            per the PRD, this is the most prominent section of the dashboard. */}
        {progress === null ? (
          <Card className="mt-6 p-4 text-sm text-muted-foreground">
            <Link href="/setup" className="font-medium text-foreground underline">
              Finish setup
            </Link>{" "}
            to start rank tracking.
          </Card>
        ) : (
          <Card className="mt-6 p-4">
            <p className="text-sm text-muted-foreground">Your Progress</p>
            <p className="mt-1 font-medium">
              {progress.pct}% toward {rankData.window?.rankTarget} rank
            </p>
            <Progress
              value={progress.pct}
              label={`${progress.pct}% toward ${rankData.window?.rankTarget} rank`}
              className="mt-2"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {currentStreak}-day streak · Overall score {score}
            </p>
          </Card>
        )}

        <h2 className="mt-8 text-sm font-medium text-muted-foreground">Today&apos;s Tasks</h2>

        {scheduledToday.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing scheduled today.{" "}
            <Link href="/quests/new" className="font-medium text-foreground underline">
              Create a quest
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <div className="mt-3">
            <TodayChecklist
              goals={scheduledToday.map((g) => ({
                id: g.id,
                title: g.title,
                category: g.category,
                completed: completedGoalIds.has(g.id),
              }))}
            />
          </div>
        )}

        {overallGoals.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground">
              Tracked as overall progress (not part of your daily checklist)
            </p>
            <ul className="mt-3 space-y-2">
              {overallGoals.map((g) => (
                <li key={g.id}>
                  <Card className="p-4">
                    <span className="block font-medium">{g.title}</span>
                    <span className="block text-sm text-muted-foreground">{g.category}</span>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button asChild variant="outline" className="mt-6 h-11 w-full rounded-full">
          <Link href="/quests/new">Create a Quest</Link>
        </Button>
      </div>
    </div>
  );
}
