"use server";

import { redirect } from "next/navigation";
import { toUserError } from "@/lib/errors";
import { createGoalEntrySchema, createGoalSchema } from "@/lib/schemas/goal";
import { createClient } from "@/lib/supabase/server";
import { todayInTimezone, userTimezone } from "@/lib/today";

// Phase 1 slice 1: goal creation, Quests domain only (per CLAUDE.md's
// sequencing -- Spirituality/Learning reuse this same path in Phase 2 as
// near-identical variants, not built yet). domain is hardcoded server-side,
// not a form field, since this route is Quests-specific.
export async function createQuest(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const description = formData.get("description");
  const targetDate = formData.get("targetDate");

  const parsed = createGoalSchema.safeParse({
    domain: "quest",
    title: formData.get("title"),
    // Blank optional fields come through FormData as "", not absent --
    // treat blank as "not provided" rather than storing an empty string.
    description: description ? description : null,
    category: formData.get("category"),
    frequency: formData.get("frequency"),
    // Native checkboxes are only present in FormData when checked.
    dailyTracking: formData.get("dailyTracking") === "on",
    startDate: formData.get("startDate"),
    targetDate: targetDate ? targetDate : null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // user_id comes from the authenticated session, never from client input --
  // RLS's WITH CHECK (auth.uid() = user_id) would reject a mismatch anyway,
  // but this shouldn't be the only thing standing between form input and the
  // row that gets written.
  const { error } = await supabase.from("goals").insert({
    user_id: user.id,
    domain: parsed.data.domain,
    title: parsed.data.title,
    description: parsed.data.description,
    category: parsed.data.category,
    frequency: parsed.data.frequency,
    daily_tracking: parsed.data.dailyTracking,
    start_date: parsed.data.startDate,
    target_date: parsed.data.targetDate,
  });

  if (error) {
    return { error: toUserError(error, "createQuest") };
  }

  redirect("/dashboard");
}

// Phase 1 slice 2: entry tracking. Called imperatively from the today's-
// quests checklist's checkbox onChange, not through a <form action> --
// there's no form-reset behavior to work around (P1-8) when the action is
// invoked directly rather than as a form's action.
//
// `date` is deliberately NOT a parameter: it is always today, computed
// server-side from the signed-in user's own stored timezone (ADR-006), the
// same "never trust the client for something the server can derive
// authoritatively" posture createQuest already takes for user_id. A client-
// supplied date would let a stale browser tab, a manipulated request, or
// simple clock drift write to the wrong calendar day.
export async function upsertGoalEntry(
  goalId: string,
  completed: boolean,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const today = todayInTimezone(userTimezone(user));

  const parsed = createGoalEntrySchema.safeParse({ goalId, date: today, completed });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // No explicit goal-ownership check before the upsert: RLS's WITH CHECK on
  // goal_entries (goal_id in the caller's own goals, join-through per
  // ADR-003) is the actual boundary here, same as goals' own policy. A
  // goalId for someone else's goal is rejected by the database, not by
  // application logic -- this is the security model ADR-003 chose
  // deliberately, not a gap.
  const { error } = await supabase.from("goal_entries").upsert(
    {
      goal_id: parsed.data.goalId,
      date: parsed.data.date,
      completed: parsed.data.completed,
    },
    { onConflict: "goal_id,date" },
  );

  if (error) {
    return { error: toUserError(error, "upsertGoalEntry") };
  }

  return { error: null };
}
