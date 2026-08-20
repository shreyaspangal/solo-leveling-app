import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type NavItem, NavLinks } from "@/components/ui/nav-links";
import { Progress } from "@/components/ui/progress";
import { RankBadge } from "@/components/ui/rank-badge";
import { getRankData } from "@/lib/rank-data";
import { rankProgress } from "@/lib/rank-engine/engine";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone, userTimezone } from "@/lib/today";

// ADR-007 Phase 9 (2026-08-20 owner decision, supersedes the U20 amendment's
// single responsive row): the reference's left rail (desktop) / bottom bar
// (mobile) structure, all 6 modules. Icons match the reference's own import
// list exactly (docs/reference/client-ui-prototype.tsx line 39-42) --
// Home/Sparkles/Wallet/Dumbbell/GraduationCap/Swords for
// Command/Spirituality/Finance/Fitness/Learning/Quests respectively --
// `icon` is a string key (`nav-links.tsx`'s `ICONS` map resolves it to the
// actual component), not the component itself: audit finding U30, functions
// cannot cross the Server->Client boundary as a prop value (the same class
// of violation as U16, this time a 500 on every authenticated route instead
// of a caught type/lint/test error, since `LucideIcon`-typed props
// type-check fine right up until the real request that tries to serialize
// one). Spirituality/Finance/Fitness/Learning have `href: null` -- ADR-001
// models Spirituality/Learning already, but no route creates a goal in
// either (only /quests/new, hardcoded to domain "quest"), so all four
// render as disabled coming-soon tiles, same treatment regardless of which
// ADR eventually owns them. "Quests" points at /quests (Phase 10's real
// tabs/detail-pane view, replacing the dead redirect that used to live
// there) -- goal creation is still reachable from inside that view's "New
// Quest" action, not a separate nav destination. "Command" is this app's
// existing /dashboard, matching the reference's `short: "Home"`.
const NAV_ITEMS: NavItem[] = [
  { key: "home", label: "Command", short: "Home", icon: "home", href: "/dashboard" },
  { key: "spirituality", label: "Spirituality", short: "Spirit", icon: "spirituality", href: null },
  { key: "finance", label: "Finance", short: "Finance", icon: "finance", href: null },
  { key: "fitness", label: "Fitness", short: "Fitness", icon: "fitness", href: null },
  { key: "learning", label: "Learning", short: "Learn", icon: "learning", href: null },
  { key: "quests", label: "Quests", short: "Quests", icon: "quests", href: "/quests" },
];

// Async Server Component, not "use client" -- needs its own rank-data fetch
// for the rail's persistent rank card (the reference's sidebar shows one;
// see docs/reference/client-ui-prototype.tsx line 1420). Only the
// interactive per-link active-state (`usePathname`) is client-side, isolated
// in `NavLinks`. Takes `children` and renders the full page shell (header +
// rail + content + mobile bottom bar) rather than being one more sibling
// each page assembles by hand -- callers just wrap their content.
export async function NavShell({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defensive, not the primary gate -- every page that renders NavShell
  // already redirects unauthenticated visitors before reaching this point.
  if (!user) {
    redirect("/login");
  }

  const today = todayInTimezone(userTimezone(user));
  const rankData = await getRankData(supabase);
  const progress = rankData.window
    ? rankProgress(rankData.goals, rankData.entries, rankData.window, today)
    : null;

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* Reference puts sign-out in a topbar avatar dropdown (line 1424-1436)
          -- not built here: it needs a new dropdown-menu primitive and a
          displayable user name neither of which exist yet, a real scope
          increase beyond "nav rebuild." This thin header is the deliberate
          simplification: it's the one sign-out affordance reachable at every
          viewport (the rail is desktop-only, the bottom bar's 6 slots are
          full), not a stand-in for the full menu. */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="font-heading text-sm text-secondary uppercase tracking-[2px] [text-shadow:0_0_10px_var(--secondary)]">
          System
        </span>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" className="size-11">
            <LogOut className="size-4" />
          </Button>
        </form>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-[210px] shrink-0 flex-col border-r border-border md:flex">
          <NavLinks items={NAV_ITEMS} variant="rail" />
          {rankData.window && progress && (
            <div className="mx-3 mt-auto mb-3">
              <Card brackets className="p-3 text-center">
                <div className="flex justify-center">
                  <RankBadge rankTarget={rankData.window.rankTarget} className="size-12" />
                </div>
                <p className="mt-1.5 text-[9px] text-muted-foreground uppercase tracking-[2px]">
                  Current Rank
                </p>
                <Progress
                  value={progress.pct}
                  label={`${progress.pct}% toward ${rankData.window.rankTarget} rank`}
                  className="mt-2"
                />
                <p className="mt-1.5 font-heading text-[11px] text-muted-foreground">
                  {progress.pct}% &rarr; {rankData.window.rankTarget}
                </p>
              </Card>
            </div>
          )}
        </aside>

        {/* Audit finding U32: a flex child defaults to min-width:auto, which
            floors its shrink at its content's intrinsic width -- /quests'
            two-column grid was pinning this at 429px regardless of
            viewport. min-w-0 lets it actually shrink to the viewport. */}
        <main className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-background/95 backdrop-blur md:hidden">
        <NavLinks items={NAV_ITEMS} variant="bottom" />
      </nav>
    </div>
  );
}
