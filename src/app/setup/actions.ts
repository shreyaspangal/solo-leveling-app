"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ADR-003: the first RankWindow row is created here, at the end of setup —
// not at signup — so an account that abandons onboarding mid-flow has no
// rank tracking yet. Rank always starts as the E -> D climb.
export async function completeSetup() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("rank_windows").upsert(
    {
      user_id: user.id,
      rank_target: "D",
      window_start: today,
    },
    { onConflict: "user_id", ignoreDuplicates: true },
  );

  if (error) {
    redirect("/setup?error=1");
  }

  // Goal creation ("Create Goals" in the PRD's onboarding flow) is Phase 1
  // (Quests pilot) work -- this hands off to the dashboard placeholder until
  // that vertical slice exists.
  redirect("/dashboard");
}
