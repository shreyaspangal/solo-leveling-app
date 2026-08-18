import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "./env";

// Server-side Supabase client (Server Components, Server Actions, Route
// Handlers). Forwards the user's JWT via cookies so RLS policies (ADR-003)
// apply identically to server-issued queries -- there is no separate
// "trusted server" bypass path.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component -- middleware refreshes the
          // session instead, so a failed cookie write here is expected and
          // safe to ignore.
        }
      },
    },
  });
}
