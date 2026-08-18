import type { NextConfig } from "next";

// Security headers (audit finding S2). Applied globally via headers() so
// they land on every response without per-route wiring.
//
// LIMITATION, not yet resolved: script-src needs 'unsafe-inline' because
// Next.js injects inline hydration/RSC bootstrap scripts and this app has no
// nonce plumbing yet (would require generating a per-request nonce in
// src/proxy.ts and threading it through). Tracked as a guardrail in
// docs/audit/PHASE_0_AUDIT.md -- move to a nonce-based CSP before public
// launch if XSS risk from third-party script injection becomes a concern.
const isDev = process.env.NODE_ENV === "development";

function buildCsp(): string {
  return [
    "default-src 'self'",
    // React dev mode uses eval() for debugging (callstack reconstruction) --
    // dev-only, never ships to production (audit finding S8).
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    // Supabase Auth/REST/Storage, plus the local Supabase CLI stack in dev
    // (audit finding S9) so the browser client isn't silently blocked the
    // moment Phase 1 starts using it against `supabase start`.
    `connect-src 'self' https://*.supabase.co${isDev ? " http://127.0.0.1:54321 ws://127.0.0.1:54321" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    // Must list every origin a form submission's redirect chain can land on,
    // not just the origin submitted to -- Chrome validates each hop against
    // form-action. The OAuth buttons POST same-origin but the server action
    // redirects out through Supabase's /auth/v1/authorize to the provider
    // (audit finding S7); omitting these silently breaks "Continue with
    // Google/Apple" with no visible error to the user, only a console one.
    "form-action 'self' https://*.supabase.co https://accounts.google.com https://appleid.apple.com",
  ].join("; ");
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: buildCsp() },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
