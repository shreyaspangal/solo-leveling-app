// RLS isolation tests (ADR-003, audit finding D7, part 2). ADR-003's test
// surface is explicit: "user A cannot select/update/delete user B's goals,
// entries, or rank window, even with a directly-crafted query -- test
// against the real database, not mocked." This exercises that directly:
// real signups, real Postgres, real RLS policies from the migrations --
// through the plain @supabase/supabase-js client (not the Next.js SSR
// wrapper, since RLS enforcement doesn't depend on cookie plumbing).
//
// Requires a running local Supabase (`supabase start`, needs Docker) --
// kept out of the fast pure-unit suite, run via `npm run test:rls`. See
// vitest.config.integration.mts.
import { randomUUID } from "node:crypto";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// These tests create throwaway users and never clean them up, relying on
// the instance being fully disposable (`supabase start` / `supabase stop`).
// Refuse to run against anything else -- accidentally pointing this at the
// real linked project would litter it with test accounts.
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(SUPABASE_URL)) {
  throw new Error(
    `Refusing to run RLS integration tests against a non-local Supabase URL: ${SUPABASE_URL}. ` +
      "Run `supabase start` and point NEXT_PUBLIC_SUPABASE_URL at the local instance first.",
  );
}
if (!SUPABASE_ANON_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to the local anon key (see `supabase status`).",
  );
}

async function signUpAndSignIn(): Promise<{ client: SupabaseClient; userId: string }> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY!);
  const email = `rls-test-${randomUUID()}@example.com`;
  // Local config has enable_confirmations = false (supabase/config.toml),
  // so signUp already returns a usable session -- no confirmation step.
  const { data, error } = await client.auth.signUp({
    email,
    password: "not-a-real-password-123",
  });
  if (error || !data.user) throw error ?? new Error("signUp returned no user");
  return { client, userId: data.user.id };
}

describe("RLS isolation (ADR-003) -- real local Postgres, not mocked", () => {
  let userA: SupabaseClient;
  let userB: SupabaseClient;
  let userAId: string;
  let goalAId: string;

  beforeAll(async () => {
    const a = await signUpAndSignIn();
    const b = await signUpAndSignIn();
    userA = a.client;
    userB = b.client;
    userAId = a.userId;

    const { data: goal, error: goalError } = await userA
      .from("goals")
      .insert({
        user_id: userAId,
        domain: "quest",
        title: "User A's private goal",
        category: "test",
        frequency: "daily",
        start_date: "2026-01-01",
      })
      .select()
      .single();
    if (goalError || !goal) throw goalError ?? new Error("goal insert returned nothing");
    goalAId = goal.id;

    const { error: entryError } = await userA.from("goal_entries").insert({
      goal_id: goalAId,
      date: "2026-01-01",
      completed: true,
    });
    if (entryError) throw entryError;

    const { error: milestoneError } = await userA.from("milestones").insert({
      goal_id: goalAId,
      title: "First checkpoint",
      order: 0,
    });
    if (milestoneError) throw milestoneError;

    const { error: windowError } = await userA.from("rank_windows").insert({
      user_id: userAId,
      rank_target: "D",
      window_start: "2026-01-01",
    });
    if (windowError) throw windowError;
  });

  it("user A can see their own goal, entry, milestone, and rank window", async () => {
    const { data: goals } = await userA.from("goals").select("*").eq("id", goalAId);
    expect(goals).toHaveLength(1);
    const { data: entries } = await userA
      .from("goal_entries")
      .select("*")
      .eq("goal_id", goalAId);
    expect(entries).toHaveLength(1);
    const { data: milestones } = await userA
      .from("milestones")
      .select("*")
      .eq("goal_id", goalAId);
    expect(milestones).toHaveLength(1);
    const { data: windows } = await userA.from("rank_windows").select("*").eq("user_id", userAId);
    expect(windows).toHaveLength(1);
  });

  it("user B's directly-crafted select returns nothing for user A's goal", async () => {
    const { data, error } = await userB.from("goals").select("*").eq("id", goalAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("user B's directly-crafted update against user A's goal affects nothing", async () => {
    const { data, error } = await userB
      .from("goals")
      .update({ title: "hijacked" })
      .eq("id", goalAId)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]); // RLS's USING clause filters the row out before the update applies

    const { data: check } = await userA.from("goals").select("title").eq("id", goalAId).single();
    expect(check?.title).toBe("User A's private goal");
  });

  it("user B's directly-crafted delete against user A's goal affects nothing", async () => {
    const { data, error } = await userB.from("goals").delete().eq("id", goalAId).select();
    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: check } = await userA.from("goals").select("id").eq("id", goalAId);
    expect(check).toHaveLength(1);
  });

  it("user B cannot select user A's goal entries (join-through policy)", async () => {
    const { data, error } = await userB
      .from("goal_entries")
      .select("*")
      .eq("goal_id", goalAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("user B's insert against user A's goal_id is rejected by WITH CHECK", async () => {
    // Unlike select/update/delete (which silently affect 0 rows once USING
    // filters them out), an INSERT has no "matched 0 rows" outcome -- a
    // failed WITH CHECK surfaces as an explicit error instead.
    const { error } = await userB.from("goal_entries").insert({
      goal_id: goalAId,
      date: "2026-01-02",
      completed: true,
    });
    expect(error).not.toBeNull();
  });

  it("user B cannot select user A's milestones (join-through policy)", async () => {
    const { data, error } = await userB.from("milestones").select("*").eq("goal_id", goalAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("user B cannot select user A's rank window", async () => {
    const { data, error } = await userB
      .from("rank_windows")
      .select("*")
      .eq("user_id", userAId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
