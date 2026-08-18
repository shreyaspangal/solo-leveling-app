"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone } from "@/lib/today";

// ADR-003: the first RankWindow row is created here, at the end of setup —
// not at signup — so an account that abandons onboarding mid-flow has no
// rank tracking yet. Rank always starts as the E -> D climb.
export async function completeSetup(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // ADR-006: captured client-side (the server can't know the user's
  // timezone), stored once so every future "what is today for this user"
  // computation -- including this window's own window_start -- uses it
  // instead of the server's UTC clock.
  const timezoneEntry = formData.get("timezone");
  const timezone = typeof timezoneEntry === "string" && timezoneEntry ? timezoneEntry : undefined;
  if (timezone) {
    await supabase.auth.updateUser({ data: { timezone } });
  }

  const today = todayInTimezone(timezone);

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
