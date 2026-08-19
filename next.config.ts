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
    // 'unsafe-inline' here is load-bearing beyond the script-src case above
    // (audit finding U2, ADR-007 phase 5): Motion for React (RankBadge,
    // NavShell) animates by writing inline style= attributes every frame.
    // CSP nonces cover <style> elements and <script>, never style=
    // attributes -- there is no nonce-based fix for this half of the
    // policy. A future nonce migration for script-src (see the
    // script-src comment above) must leave style-src's 'unsafe-inline' in
    // place, or both animated components break.
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
  // Dev-only (audit finding U9, ADR-007 workstream): without this, the dev
  // server 403s HMR/chunk requests whose Origin header is 127.0.0.1 --
  // .env.local points the Supabase client at http://127.0.0.1:54321, so
  // that's the host people here naturally use, and the failure reads as an
  // application bug rather than a dev-server origin check. No effect on
  // production (Next.js only consults this in dev).
  allowedDevOrigins: ["127.0.0.1"],
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
