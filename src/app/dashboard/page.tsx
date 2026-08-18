import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Placeholder: the real Home Dashboard is Phase 1 (Quests pilot) work, per
// CLAUDE.md's build order. This just confirms onboarding completed.
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
      <h1 className="text-2xl font-semibold tracking-tight">You&apos;re set up.</h1>
      <p className="mt-3 max-w-sm text-zinc-600 dark:text-zinc-400">
        The Home Dashboard and goal creation ship in Phase 1. Rank tracking
        starts today at E rank, working toward D.
      </p>
    </div>
  );
}
