import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TimezoneSync } from "../timezone-sync";

// Placeholder: the real Home Dashboard is Phase 1 slice 4. Goal creation
// (slice 1) exists at /quests/new; this page just links to it until the
// dashboard assembles goals/streak/rank into one view.
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
      <Link
        href="/quests/new"
        className="mt-6 flex h-11 items-center justify-center rounded-full bg-foreground px-6 font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        Create a Quest
      </Link>
    </div>
  );
}
