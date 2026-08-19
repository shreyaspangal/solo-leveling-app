// NEXT_PUBLIC_* variables must be read as static literal properties, never
// through a bracket/computed lookup keyed by a variable -- Next.js's
// bundler only inlines the former into the client bundle. A dynamic-key
// helper reads correctly on the server (Node has a real process.env) but
// silently returns undefined in the browser, where `process` doesn't exist
// at all -- audit finding P1-9. The duplication between the two functions
// below is the fix, not a pre-refactor step: sharing a name-parameterized
// helper is exactly what reintroduces the dynamic-key access this exists
// to avoid.
export function supabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }
  return value;
}

export function supabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error("Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return value;
}
