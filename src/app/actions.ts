"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Server Action (form POST), not a link -- U3/nav wiring (ADR-007 phase 6).
// A GET-triggered sign-out is prefetchable (a crawler or Next's own link
// prefetching could trigger it) and CSRF-triggerable from another origin;
// a form POST through a Server Action has neither problem, matching every
// other mutation in this app. Calls the server client's signOut(), which
// revokes the session server-side via the auth cookies this request has
// access to -- not just clearing client-side state, so a replayed
// pre-signout cookie stops authenticating rather than merely no longer
// being sent by this browser.
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
