// Authenticated route smoke check (docs/audit/CODE_CHECKLIST.md rule 0).
//
// Two Criticals (U16, U30) reached "pending verification" behind a fully
// green tsc/eslint/vitest/build suite -- both were the app 500ing for every
// signed-in user. None of those four checks issue a real HTTP request
// against a signed-in session: `next build` doesn't exercise cookie-reading
// dynamic routes, and the offending values (a function crossing the RSC
// boundary) type-check cleanly. This is the fifth check that closes that
// gap. `npm run smoke` must be green before any "built, pending
// verification" handoff -- see the checklist's rule 0.
//
// Requirements this implements (owner-relayed via the auditer session,
// 2026-08-20):
//   1. Authenticates for real -- an anonymous request would have passed on
//      both U16 and U30 and caught neither.
//   2. Asserts on every route that renders a shared shell, DERIVED by
//      scanning src/app for `page.tsx` files that reference `NavShell`,
//      not hardcoded -- a new route under the shell is covered by default.
//   3. Doesn't trust status alone: scans the response body for known
//      Next.js/React error-page markers, so an error boundary swallowing a
//      throw into a 200 doesn't read as a pass.
//   4. Fast, dependency-light: plain `fetch`, no browser. Session cookies
//      come from @supabase/ssr's own `createServerClient` (via
//      `auth.setSession` into an in-memory jar) -- the real `sb-*-auth-token`
//      wire format, not hand-encoded (see the U30 audit entry for why that
//      matters).
//   5. Non-zero exit on any failure; prints the offending route and the
//      first line of the response body.
//
// Requires a running local Supabase (`supabase start`) and a running Next
// server. Neither is started here -- point SMOKE_BASE_URL at one.
//
//   SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke

import { randomUUID } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServerClient } from "@supabase/ssr";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const APP_DIR = path.join(REPO_ROOT, "src/app");

// Audit finding (auditer's Phase 9 re-verification, gap 1): a cold `npm run
// smoke` exited 1 on a missing env var instead of checking anything --
// NEXT_PUBLIC_SUPABASE_ANON_KEY lives in .env.local, which Next.js loads
// automatically but a plain `node` invocation does not. Loaded manually
// here (not via Node's `--env-file` flag) so a missing .env.local -- e.g. in
// CI, where the values come from real environment variables instead -- is
// not a hard error; already-set variables always win over the file.
function loadEnvLocal(): void {
  const envPath = path.join(REPO_ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

// Generic Next.js/React failure signatures -- not specific to any one bug,
// deliberately: the point is to catch an error boundary that turns a real
// throw into a 200 rather than to enumerate every message we've seen. The
// last one is the exact U30 message, added after the auditer's synthetic
// 200-with-error-body test found it missing (gap 2) -- kept alongside the
// generic ones, not instead of them.
const BODY_ERROR_MARKERS = [
  "Internal Server Error",
  "Application error: a client-side exception",
  "nextjs-portal", // dev-mode error overlay custom element
  "__next_error__",
  "Functions cannot be passed directly to Client Components",
];

// Any page.tsx that references NavShell renders the shared shell today
// (docs/audit/CODE_CHECKLIST.md rule 1: "after any change to a shared
// shell/layout component, load a real authenticated page"). Walking the
// filesystem instead of hardcoding a route list means a new page picks this
// check up automatically the moment it adopts the shell, per requirement 2.
function findShellRoutes(dir: string, urlPrefix: string): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Route groups `(name)` are invisible in the URL.
      const segment = entry.startsWith("(") && entry.endsWith(")") ? "" : `/${entry}`;
      routes.push(...findShellRoutes(full, urlPrefix + segment));
    } else if (entry === "page.tsx") {
      const source = readFileSync(full, "utf8");
      if (/\bNavShell\b/.test(source)) {
        routes.push(urlPrefix.length > 0 ? urlPrefix : "/");
      }
    }
  }
  return routes;
}

function fail(message: string): never {
  console.error(`smoke: ${message}`);
  process.exit(1);
}

async function createSessionCookieHeader(): Promise<string> {
  const jar = new Map<string, string>();
  // Same library, same code path production uses -- see the U30 audit
  // entry for why this isn't hand-rolled cookie encoding.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY as string, {
    cookies: {
      getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
      setAll: (cookiesToSet) => {
        for (const { name, value } of cookiesToSet) jar.set(name, value);
      },
    },
  });

  const { data, error } = await supabase.auth.signUp({
    email: `smoke-${randomUUID()}@example.com`,
    password: "not-a-real-password-123",
  });
  if (error || !data.session) {
    fail(
      `could not create a session -- ${error?.message ?? "no session returned"}. ` +
        "Is local Supabase running? (`supabase start`)",
    );
  }
  return Array.from(jar, ([name, value]) => `${name}=${value}`).join("; ");
}

async function main() {
  if (!SUPABASE_ANON_KEY) {
    fail("NEXT_PUBLIC_SUPABASE_ANON_KEY must be set (see `supabase status`).");
  }

  const routes = findShellRoutes(APP_DIR, "");
  if (routes.length === 0) {
    fail("found zero routes rendering NavShell -- check the NavShell match, or that src/app moved.");
  }

  const cookieHeader = await createSessionCookieHeader();

  let anyFailed = false;
  for (const route of routes) {
    const url = new URL(route, BASE_URL);
    let response: Response;
    try {
      response = await fetch(url, { headers: { Cookie: cookieHeader }, redirect: "manual" });
    } catch (err) {
      anyFailed = true;
      console.error(`smoke FAIL ${route}: could not reach ${BASE_URL} -- ${(err as Error).message}`);
      console.error(`  Is a server running? (SMOKE_BASE_URL=${BASE_URL})`);
      continue;
    }

    const body = await response.text();
    const marker = BODY_ERROR_MARKERS.find((m) => body.includes(m));

    if (response.status !== 200 || marker) {
      anyFailed = true;
      const firstLine = body.split("\n").find((line) => line.trim().length > 0) ?? "(empty body)";
      console.error(
        `smoke FAIL ${route}: HTTP ${response.status}${marker ? ` [error marker: "${marker}"]` : ""}`,
      );
      console.error(`  ${firstLine.trim().slice(0, 200)}`);
    } else {
      console.log(`smoke OK   ${route}`);
    }
  }

  if (anyFailed) {
    console.error(`\nsmoke: FAILED (${routes.length} route(s) checked against ${BASE_URL}).`);
    process.exit(1);
  }
  console.log(`\nsmoke: ${routes.length} route(s) OK against ${BASE_URL}.`);
}

main();
