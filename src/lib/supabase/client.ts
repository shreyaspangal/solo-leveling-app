import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

// Browser-side Supabase client. RLS (ADR-003) is the actual isolation
// boundary, so this client is not "less trusted" than the server client --
// both forward the same user JWT and hit the same policies.
export function createClient() {
  return createBrowserClient(supabaseUrl(), supabaseAnonKey());
}
