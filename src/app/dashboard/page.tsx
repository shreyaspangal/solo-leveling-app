import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TimezoneSync } from "../timezone-sync";

// Placeholder: the real Home Dashboard is Phase 1 slice 4. Goal creation
// (slice 1) is at /quests/new, today's checklist (slice 2) is at /quests;
// this page just links to them until the dashboard assembles goals/streak/
// rank into one view.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <TimezoneSync />
      <h1 className="text-2xl font-semibold tracking-tight">You&apos;re set up.</h1>
      <p className="mt-3 max-w-sm text-zinc-600 dark:text-zinc-400">
        The full Home Dashboard is still being built. Rank tracking starts
        today at E rank, working toward D.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/quests"
          className="flex h-11 items-center justify-center rounded-full bg-foreground px-6 font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Today&apos;s Quests
        </Link>
        <Link
          href="/quests/new"
          className="flex h-11 items-center justify-center rounded-full border border-zinc-300 px-6 font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Create a Quest
        </Link>
      </div>
    </div>
  );
}
