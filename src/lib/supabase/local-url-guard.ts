// Used by the RLS integration test (audit finding D7) to refuse running
// against anything but a local Supabase instance, since those tests create
// throwaway users and never clean them up.
//
// Audit finding D8: an earlier version regex-matched the raw URL string,
// which a URL's userinfo component could defeat --
// "http://localhost:54321@evil.com/" matched while the real host was
// evil.com. Parse the URL and inspect the actual hostname instead of
// pattern-matching the raw text.
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function isLocalSupabaseUrl(url: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return LOCAL_HOSTNAMES.has(hostname);
}
