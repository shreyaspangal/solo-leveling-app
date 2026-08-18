# Phase 0 Audit — Findings & Guardrails

**Date:** 2026-08-18
**Scope:** Full repo as of Phase 0 (auth flows, rank engine, schemas, migrations, config) — commit `aad9ce4` + uncommitted Phase 0 work.
**Result:** `tsc --noEmit` clean, `eslint` clean, `vitest run` 16/16 passing, no secrets in git history, RLS applied uniformly across all tables.

This file is the running log for cross-session audit findings. Every entry has a **Guardrail** —
the concrete rule, check, or process change that prevents the same class of issue from
recurring, independent of which session (human or agent) touches the code next. When an item is
fixed, update its Status rather than deleting the row — the guardrail is the part worth keeping
even after the specific instance is resolved.

## Status legend
`OPEN` — not yet fixed · `FIXED` — resolved, guardrail should now be enforced · `ACCEPTED` — known tradeoff, not being fixed, documented so it isn't "rediscovered"

---

## Security

### S1. No rate limiting on `login`/`signup` server actions
**Status:** PARTIALLY FIXED — app-layer throttling added; production-scale storage still OPEN.
**Where:** `src/lib/rate-limit.ts` (sliding-window limiter, TDD, 6 tests), `src/lib/request-ip.ts` (IP extraction via `x-forwarded-for`, trusted because Vercel sets it at the edge), wired into `logInWithEmail` (5/min/IP) and `signUpWithEmail` (3/min/IP) via the `api-rate-limiting` skill.
**Finding:** The limiter's store is an in-memory `Map`, scoped to one server process. On Vercel's serverless runtime, a given IP's requests can land on different instances, so this bounds abuse within a warm instance but does **not** enforce a true global limit across a multi-instance production deployment. OAuth (Google/Apple) paths are intentionally not throttled here -- they redirect out to the provider immediately, which is the actual brute-force chokepoint.
**Guardrail:** Before this app takes real production traffic, swap `rate-limit.ts`'s in-memory store for Vercel KV / Upstash Redis (both fit a Vercel deploy target, per the `api-rate-limiting` skill's storage-backend guidance) -- the `checkRateLimit`/`resetRateLimitStore` call sites don't need to change, only the store implementation. Any new server action that accepts credentials or triggers an email/SMS send gets rate-limited the same way, through the same utility, not a copy of the logic.

### S2. No security headers configured
**Status:** PARTIALLY FIXED — baseline header set added; CSP's `script-src` still needs `'unsafe-inline'` in production.
**Review note (2026-08-18, review session):** the header set was independently verified as landing correctly on both pages and static assets, in prod *and* dev builds. However, browser testing of the same CSP surfaced three follow-on defects — see S7, S8, S9, all now FIXED below.
**Where:** `next.config.ts` (`headers()`, applied to `/:path*`).
**Finding:** Config was empty — no CSP, `X-Frame-Options`, `Referrer-Policy`, HSTS, etc. Now sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/microphone/geolocation denied), HSTS (`max-age=63072000; includeSubDomains; preload`), and a CSP scoped to `'self'` plus `https://*.supabase.co` on `connect-src` for Auth/REST/Storage.
**Guardrail:** The CSP's `script-src 'self' 'unsafe-inline'` is a real gap, not closed by this fix — Next.js injects inline hydration/RSC bootstrap scripts, and this app has no nonce plumbing (`src/proxy.ts` would need to generate a per-request nonce and thread it through) to drop `'unsafe-inline'` safely. **Before public launch, move to a nonce-based CSP** (Next.js supports this via a nonce set in middleware/proxy + read via `headers()` in the root layout) so injected third-party script content can't execute even if HTML injection occurs elsewhere. Verify headers with `curl -I` against a running build whenever `next.config.ts`'s `headers()` block changes.

### S7. CSP `form-action 'self'` blocks the Google/Apple OAuth flow
**Status:** FIXED — `form-action` now reads `'self' https://*.supabase.co https://accounts.google.com https://appleid.apple.com` (`next.config.ts`), covering both hops of the redirect chain (Supabase `/auth/v1/authorize`, then the provider). Verified: prod build's `curl -I` response includes the widened directive; dev build likewise. Not re-verified against a real browser in this session — that re-check belongs to the review session per the session-split convention below.
**Review note — VERIFIED FIXED (2026-08-18, review session, Chrome via Playwright against a `next build` + `next start` production server, temporary probe route since removed):**
- redirect to `https://accounts.google.com/...`: **ALLOWED** — the browser navigated all the way to the real Google endpoint, which returned a genuine `invalid_request` / "Required parameter is missing: response_type" page (the probe URL deliberately carried no OAuth params). A real cross-origin OAuth-origin navigation completed end to end.
- redirect to `https://example.supabase.co/auth/v1/authorize` (matches `https://*.supabase.co`): **ALLOWED** — browser left the page and attempted the target, failing only on DNS for the placeholder host, with no CSP violation.
- **Control case** — redirect to `https://example.com/` (deliberately *not* in the allowlist): **still BLOCKED**, with `... violates the following Content Security Policy directive: "form-action 'self' https://*.supabase.co https://accounts.google.com https://appleid.apple.com"`. This matters: it proves the allowlist is *precise* — CSP is still enforcing `form-action`, it just now permits exactly the OAuth origins, rather than the directive having been effectively disabled.
- Production policy confirmed strict: no `'unsafe-eval'` and no localhost origin present in the prod build's header.
**Remaining caveat:** this exercises the *CSP mechanics* of the redirect chain, not a live Google/Apple handshake (no real Supabase project is wired up). The pre-launch manual OAuth click-through in the guardrail below still stands.
**Where:** `next.config.ts` (CSP `form-action 'self'`), triggered by `src/app/login/page.tsx` + `src/app/signup/page.tsx` (`<form action={logInWithGoogle}>` etc.) → `src/lib/supabase/oauth.ts` (`redirect(data.url)`).
**Finding:** The OAuth buttons are HTML forms whose server action responds with a redirect to an external origin (Supabase's `/auth/v1/authorize`, which itself redirects on to `accounts.google.com` / `appleid.apple.com`). Chrome validates **every hop of a form submission's redirect chain** against `form-action`, so the navigation is blocked. Email login/signup are unaffected — their redirects are same-origin.

Verified empirically (review session, temporary route since removed, Chrome via Playwright against a real dev server):
- form POST → **cross-origin** redirect: **BLOCKED** — `Sending form data to 'http://localhost:3412/csptest/go' violates the following Content Security Policy directive: "form-action 'self'". The request has been blocked.` (note Chrome names the *original* action URL in the message even though the violation is the redirect hop — easy to misdiagnose)
- form POST → **same-origin** redirect: navigated successfully, no violation

This fails silently from the user's perspective: clicking "Continue with Google" does nothing visible, with the only signal in the browser console.
**Guardrail:** `form-action` must list every origin a form submission can be redirected *to*, not just the origin it's submitted to — the redirect chain counts. Concretely: `form-action 'self' https://*.supabase.co https://accounts.google.com https://appleid.apple.com`. **General rule: any CSP directive change must be validated against a real browser navigating the actual flow, not just `curl -I` confirming the header is present.** A header that is present and syntactically valid can still break a user-facing flow — presence is not correctness. Add the OAuth click-through to the pre-launch manual test list, since no automated test covers it today.

### S8. CSP `script-src` omits `'unsafe-eval'` in development, breaking React dev tooling
**Status:** FIXED — `next.config.ts` now appends `'unsafe-eval'` to `script-src` only when `process.env.NODE_ENV === "development"`. Verified: dev build's CSP header includes it, prod build's does not (checked both via `curl -I`).
**Review note — VERIFIED FIXED (2026-08-18, review session, Chrome against `next dev`):** `/rules` now loads with a completely clean console — **0 errors, 0 warnings**; the previously permanent `eval() is not supported in this environment...` error is gone, along with the Next.js Dev Tools issues badge. Production build independently confirmed to still exclude `'unsafe-eval'`, so the relaxation did not leak into the shipping policy.
**Where:** `next.config.ts` (CSP `script-src 'self' 'unsafe-inline'`, applied in all environments).
**Finding:** React's development build uses `eval()` for debugging features (callstack reconstruction, owner stacks). Under this CSP, dev mode logs a permanent console error — `eval() is not supported in this environment. If this page was served with a Content-Security-Policy header, make sure that 'unsafe-eval' is included...` — and raises a Next.js Dev Tools issues badge. Verified in a real browser against `next dev`. The app still renders and hydrates correctly (checkbox state and gated navigation on `/rules` both worked), so this is a **developer-experience regression, not app breakage**: degraded React error diagnostics plus permanent console noise that will mask real errors during Phase 1 development.
**Guardrail:** Relax `script-src` **for development only**, keeping production strict — e.g. append `'unsafe-eval'` when `process.env.NODE_ENV === "development"`. **General rule: never loosen a production CSP to fix a dev-only problem; gate the relaxation on the environment so the strict policy is what actually ships.**

### S9. CSP `connect-src` omits the local Supabase origin (latent)
**Status:** FIXED — `next.config.ts` now appends `http://127.0.0.1:54321 ws://127.0.0.1:54321` to `connect-src` only when `process.env.NODE_ENV === "development"`, matching `supabase/config.toml`'s local API port. Verified via `curl -I` on both dev and prod builds; prod stays `https://*.supabase.co`-only.
**Review note — VERIFIED FIXED as configured (2026-08-18, review session):** dev CSP confirmed to carry `http://127.0.0.1:54321 ws://127.0.0.1:54321`; prod CSP confirmed to carry neither. The `ws://` addition is a good catch beyond what the finding asked for — Supabase Realtime would otherwise have been blocked in local dev for the same reason. **Still unproven end-to-end:** no browser request has actually been made to local Supabase, since `src/lib/supabase/client.ts` remains unimported and no `supabase start` stack was running. This closes the *configuration* gap; the first Phase 1 code to use the browser client locally is what will truly confirm it.
**Where:** `next.config.ts` (CSP `connect-src 'self' https://*.supabase.co`) vs. local Supabase at `http://127.0.0.1:54321` (`supabase/config.toml`, `[api] port = 54321`).
**Finding:** The browser Supabase client (`src/lib/supabase/client.ts`) is **not imported anywhere yet** — verified by grep — so no request is currently blocked. The moment Phase 1 uses the browser client against local Supabase, every call will be blocked by CSP, and the failure will look like a Supabase/network bug rather than a CSP one.
**Guardrail:** Allow the local Supabase origin in `connect-src` under development only (same environment-gated pattern as S8), so production keeps the `https://*.supabase.co`-only policy. **General rule: when a CSP allowlists a hosted service, check whether that service also has a localhost/dev origin, and gate that origin to development — otherwise local dev silently diverges from prod.**

### S3. `rankTarget` Zod schema is looser than the DB constraint
**Status:** FIXED — split into `rankSchema` (full E-S domain) and `rankTargetSchema` (D-S only, matches the DB check constraint), `rankTarget` field now uses the latter.
**Where:** `src/lib/schemas/rank-window.ts` (`rankSchema` = `"E"|"D"|"C"|"B"|"A"|"S"`) vs. `supabase/migrations/00000000000002_rank_window.sql:8` (check constraint only allows `'D','C','B','A','S'`)
**Finding:** `"E"` validates at the Zod layer but is rejected by the DB. If it ever reached `rankProgress`, `RANK_REQUIREMENT_DAYS["E"] = 0` would produce a divide-by-zero. Currently unreachable (nothing constructs an `"E"` target), but it means the Zod schema — which ADR-001 explicitly calls "the actual guard" — doesn't actually guard this case; the DB constraint does, silently.
**Guardrail:** **Any time a DB `check` constraint restricts an enum/range, the paired Zod schema must be written to match exactly — not to the type's full domain.** When adding or editing a migration with a `check` constraint, grep the corresponding `src/lib/schemas/*.ts` file in the same change and confirm they agree. This is a repeatable class of bug (schema/DB drift), not a one-off — worth a lint rule or code-review checklist item once more tables exist.

### S4. `.env.local.example` is gitignored, not tracked
**Status:** FIXED — added `!.env.local.example` negation after the `.env*` line; confirmed via `git check-ignore` (exit 1, no longer ignored).
**Where:** `.gitignore` (`.env*` pattern)
**Finding:** The broad `.env*` glob also catches the example/template file. Confirmed via `git check-ignore -v .env.local.example`. A fresh clone has no template to copy despite the README/onboarding flow assuming one exists.
**Guardrail:** Add `!.env.local.example` immediately after the `.env*` line in `.gitignore`. **General rule: any `.env*`-style ignore pattern must be paired with an explicit `!`-negation for the example/template file, checked in the same commit that adds the ignore pattern.**

### S5. Production Supabase auth hardening not yet verified
**Status:** PARTIALLY FIXED — email confirmation confirmed on, password policy tightened, redirect allow-list fixed; CAPTCHA and leaked-password protection still OPEN (both need an external decision, not just a config value).
**Where:** Supabase project dashboard for `qmhrfmrmpxqhcoekgwau` (not in-repo — `supabase/config.toml` is local-dev only), configured via the Management API (`PATCH /v1/projects/{ref}/config/auth`).
**Finding, and what was done once a real project existed:**
- **Email confirmation:** was already **on** in production by default (`mailer_autoconfirm: false`) — confirmed both by reading the config and empirically, via a real signup against the live Auth REST API that returned `confirmation_sent_at`. No change needed; local `config.toml`'s `enable_confirmations = false` genuinely was dev-only and never reflected prod, exactly as this finding warned.
- **Password policy:** `password_min_length` was `6` in production, weaker than the app's own Zod schema (`src/app/signup/actions.ts`'s `signUpSchema` requires `min(8)`) — a real defense-in-depth gap, since anything that reached Supabase directly without going through that Zod check could set a 6-7 char password. Raised to `8` to match.
- **Redirect allow-list (found during this pass, not in the original wording, but squarely the same "prod auth config" surface):** `uri_allow_list` was empty. `src/lib/supabase/oauth.ts` passes an explicit `redirectTo` built from `NEXT_PUBLIC_SITE_URL`, and Supabase rejects any `redirectTo` not covered by `site_url` + `uri_allow_list`. With the list empty, OAuth login/signup would have failed in every deployed environment the moment Google/Apple were actually configured — a second silent-failure mode in the same family as S7. Set to `http://localhost:3000/**,https://solo-leveling-app.vercel.app/**,https://solo-leveling-app-*.vercel.app/**` (local dev, Vercel production, Vercel preview deployments for this project specifically — not a bare `*.vercel.app` wildcard, which would trust redirect targets on *any* Vercel-hosted app).
- **Leaked-password protection (HIBP):** attempted `password_hibp_enabled: true`, rejected with HTTP 402 — "available on Pro Plans and up." This project is currently on the free tier. **Not fixed; blocked on a plan upgrade, which is a billing decision for the project owner, not something to change unilaterally.**
- **CAPTCHA:** still `security_captcha_enabled: false`. Turning this on needs an hCaptcha or Cloudflare Turnstile account (external to Supabase) to get a site key + secret — **not a config flag alone, needs a provider decision and account setup from the project owner** before it can be wired in.
**Guardrail:** Before opening real signup to the public (not just Phase 0/1 internal testing), close the two remaining items: decide on the Pro plan upgrade for HIBP, and pick + provision a CAPTCHA provider. Both are pre-launch checklist items, not Phase 0/1 blockers. **General rule: whenever `NEXT_PUBLIC_SITE_URL` or the Vercel project's domains change (custom domain, new preview naming), update `uri_allow_list` in the same change — it's easy to update the app's own env var and forget the Supabase-side allow-list has to match.**

### S6. Auth error messages passed through to the UI unfiltered
**Status:** ACCEPTED (monitor, not fixing now)
**Where:** `src/app/login/actions.ts`, `src/app/signup/actions.ts` (`error.message` rendered directly)
**Finding:** Supabase's own error messages are generally safe to show, but there's no normalization layer — if a misconfigured project ever returns something more detailed, it renders unfiltered.
**Guardrail:** No action needed now. If a future session adds a new Supabase-backed action that surfaces `error.message` to the client, sanity-check the message isn't leaking internal state (table names, stack traces) before shipping it as-is.

### S10. Rate-limit store grows without bound (no eviction sweep)
**Status:** OPEN (round-2 audit)
**Where:** `src/lib/rate-limit.ts` — module-level `const store = new Map()`.
**Finding:** An entry is deleted only when a *subsequent* call for that same identifier finds every timestamp aged out. An IP that makes one request and never returns keeps its entry forever — nothing sweeps expired keys on a timer or on write. The inline comment ("avoid leaking an entry per distinct IP forever") describes a mitigation that only covers returning visitors, not one-shot ones. Under Fluid Compute, instances are reused for a long time, so this accumulates across many requests rather than being cleared by frequent cold starts.

Severity is bounded by the fact that an attacker cannot cheaply mint distinct keys — see the `x-forwarded-for` note under "Not flagged" — so this is organic memory growth, not a cheap remote DoS.
**Guardrail:** Evict on write (sweep expired keys opportunistically) or bound the map size with an LRU. This disappears entirely when S1's guardrail is honoured and the store moves to Redis/KV with native TTLs — **prefer doing S1 rather than building a bespoke in-memory eviction sweep.** General rule: any process-local cache keyed by user-controlled input needs a bounded size or a TTL, not just per-entry expiry checked lazily on read.

### S11. `getClientIp` falls back to a single shared `"unknown"` bucket
**Status:** OPEN (round-2 audit)
**Where:** `src/lib/request-ip.ts` (`return "unknown"`).
**Finding:** When `x-forwarded-for` is absent, every caller collapses onto the identifier `"unknown"` and therefore shares **one** rate-limit bucket. In that state 5 login attempts *in total, across all users* lock out everybody — a self-inflicted denial of service rather than a protection. The header is reliably present on Vercel, so this is latent in production; it is however the normal state in local dev and in any non-Vercel environment (self-hosted, a container, a different platform, or a test harness).

Related: the trust in `x-forwarded-for` is correct **only because** the deploy target is Vercel (verified — see "Not flagged"). Nothing in the repo enforces or asserts that coupling; a future move off Vercel, or putting any proxy in front, silently converts this into a spoofable rate-limit bypass with no failing test to catch it.
**Guardrail:** Fail closed rather than merging strangers into one bucket — treat a missing IP as its own per-request identity, or skip limiting in environments where the header is legitimately absent, but never let distinct clients share a key. Prefer Vercel's own `ipAddress()` helper from `@vercel/functions` over hand-parsing the header. **General rule: a rate-limit key derived from a request header must have a defined behavior when the header is missing, and "bucket everyone together" is the one option that is always wrong.** Record the Vercel-only trust assumption as an explicit comment/assertion so a platform migration surfaces it.

---

## Correctness — rank engine (audit round 2, 2026-08-18)

> These three were found by the review session in the round-2 audit, **immediately before the planned
> ADR-002 addendum**. All three are ADR-002 semantics, not implementation slips — they should be
> resolved *in* that addendum rather than patched ahead of it, since the fix requires a decision
> about what `dailyCompletion` returning `null` is supposed to *mean*. Each was confirmed empirically
> with a temporary probe test (since removed), not by reading alone.

### C1. `rankProgress` counts a `null` completion as a miss — non-daily goals can never rank up
**Status:** FIXED — resolved in the ADR-002 addendum (`docs/adr/002-rank-streak-pause.md` §A), not patched ahead of it. `rankProgress` now skips a `null` day (`completion !== null && completion !== 100`) instead of charging it as a miss. New tests: weekly-only 4-perfect-weeks no longer resets `window_start` (`graceUsed` stays `0`); monthly-only equivalent. Commit `f67c0c6`.
**Where:** `src/lib/rank-engine/engine.ts` (`rankProgress`, `if (completion !== 100)`).
**Finding:** `dailyCompletion` returns `null` for a day with nothing scheduled (weekly goal not due) *and* for a day with no active goals at all. `rankProgress` tests `completion !== 100`, and `null !== 100`, so **every such day is charged as a miss and consumes grace**. Three misses reset `window_start`, so the window resets perpetually.

Proven empirically:
- **Weekly-only user, 4 consecutive perfect weeks** (every due day 100%, nothing missed): `window_start` had reset from `2026-01-01` to `2026-01-21`, `pct` = **2%**. The six non-due days each week burn grace, so the window can never accumulate. A user whose goals are all weekly/monthly **can never progress rank at all**, no matter how perfectly they perform.
- **Daily-goal user whose rank window predates goal creation** (window opened at setup `01-01`, first goal created `01-10`, then 11 perfect days): `window_start` reset to `2026-01-09`. The nine goal-less days were charged as misses. This is reachable through the *normal* onboarding path — ADR-003 deliberately creates the `RankWindow` at setup, before any goal exists (`src/app/setup/actions.ts`), so **every user has goal-less days at the start of their first window by construction.**

This directly contradicts ADR-002's own stated intent for `dailyCompletion`: `if active_goals.empty: return null // no goals = no score, not 0%`. The `null` is produced as designed, then consumed as if it were a miss.
**Guardrail:** Decide in the ADR-002 addendum what `null` means to each consumer, and make it explicit rather than incidental — the natural reading is that an unscheduled day is *neutral*, i.e. skipped exactly like a paused day (counts neither as hit nor miss). **General rule: a sentinel value like `null` needs its handling defined at every call site, not just at the site that produces it; `x !== 100` silently folds "nothing was due" into "you failed."** Add explicit test cases for weekly-only and monthly-only users to ADR-002's test surface — the current suite only exercises daily goals, which is why this passed 22 green tests.

### C2. `streak` breaks on any day with nothing scheduled — weekly-only users cap at 1
**Status:** FIXED — resolved alongside C1 in the same addendum (§A), same semantics: `streak` now skips a `null` day instead of ending the walk on it; a real miss still ends it. Added an explicit floor at the earliest goal's `start_date` (goals-empty short-circuits to `0`), since the walk is no longer naturally bounded by hitting a `null` day. New test: weekly-only 4-perfect-weeks now returns `streak: 4`, not `1`. All 4 pre-existing streak tests still pass unchanged. Commit `f67c0c6`.
**Where:** `src/lib/rank-engine/engine.ts` (`streak`, loop condition `dailyCompletion(...) === 100`).
**Finding:** Same `null` root cause as C1. The loop continues only while a day is `isPaused` or exactly `100`; a `null` day terminates it. Proven: a weekly-only user with **4 consecutive perfect weeks reports a streak of 1**, because the day before each due day is unscheduled and ends the walk. Paused days are correctly skipped without breaking the chain — unscheduled days should almost certainly behave the same way, but currently don't.
**Guardrail:** Resolve alongside C1 in the ADR-002 addendum, with the same semantics for both functions — `streak` and `rankProgress` must agree on what an unscheduled day means, or the two numbers shown to the user will disagree with each other. Note ADR-002's pseudocode already has the pause-skip branch spelled out; the unscheduled-day branch is simply missing from the spec, not mis-implemented against it.

### C3. `rankProgress.pct` is unbounded and has no completion behavior
**Status:** FIXED (narrowly) — `pct` now clamps to `[0, 100]` and the result carries `completed: pct >= 100` (ADR-002 addendum §B). Deliberately narrow: `rankProgress` still doesn't mutate `rank_target` or create a new `RankWindow` row — full promotion mechanics (notification, history record, next-window creation) remain explicitly undecided, same as CLAUDE.md already listed, and are Phase 1 dashboard/persistence wiring, not a pure-function decision. Also floored `required_days` at 1, a defensive belt-and-suspenders guard alongside S3's schema-level protection against `rank_target: "E"`. New tests: 200-perfect-days-vs-60-day-requirement now returns `pct: 100`/`completed: true` (was `332`); an engine-reachable-but-schema-illegal `"E"` target no longer divides by zero. Commit `f67c0c6`.
**Where:** `src/lib/rank-engine/engine.ts` (`pct: Math.round((elapsed / requiredDays) * 100)`).
**Finding:** `pct` is never clamped. Proven: 200 perfect days against D-rank's 60-day requirement returns **`pct: 332`**. Any UI binding a progress bar to this renders past full. This is the concrete form of the gap ADR-002 lists under "Explicitly out of scope" — what happens when a `RankWindow` completes (promotion, notification, history record) — which CLAUDE.md also lists under "What's explicitly NOT decided yet."
**Guardrail:** The ADR-002 addendum is the right place to close this, since it is the same decision as rank promotion: at minimum clamp `pct` to 100, and define whether reaching 100% auto-advances `rank_target` to the next rank, and what record that leaves. **General rule: a computed percentage crossing its own threshold is a state transition, not just a number to clamp — decide the transition, then the clamp follows from it.**

---

## Modularity

### M1. `signInWithOAuth` duplicated verbatim
**Status:** FIXED — moved to `src/lib/supabase/oauth.ts`, both login/signup actions now import it.
**Where:** `src/app/login/actions.ts` and `src/app/signup/actions.ts` — identical function body, re-exported under different names in each file.
**Guardrail:** Move to `src/lib/supabase/oauth.ts`, called from both. **General rule: before adding a third auth-adjacent server action (e.g. password reset) that needs OAuth or session logic, check `src/lib/supabase/` first — don't copy from login or signup actions again.**

### M2. `isoDate` regex schema duplicated
**Status:** FIXED — extracted to `src/lib/schemas/common.ts`, both `goal.ts` and `rank-window.ts` import it.
**Where:** `src/lib/schemas/goal.ts` and `src/lib/schemas/rank-window.ts` — same regex-based Zod schema defined independently in both files.
**Guardrail:** Extract to `src/lib/schemas/common.ts` now, before ADR-004/005 (Finance/Fitness schemas) copy it a third time. **General rule: any primitive validator (date strings, currency, etc.) used across more than one schema file belongs in `common.ts`, not redefined per file.**

### M3. Login/signup page markup near-identical
**Status:** OPEN (low priority)
**Where:** `src/app/login/page.tsx`, `src/app/signup/page.tsx` — Google/Apple button blocks, input styling, layout shell copy-pasted.
**Guardrail:** Not urgent at 2 pages. Once a third auth-shell page is added (e.g. password reset), extract a shared layout/button component instead of copying again.

---

## Scalability

### SC1. `rankProgress` recomputes the full window on every call
**Status:** ACCEPTED (deliberate ADR-001 tradeoff) — but the query boundary around it is unresolved
**Where:** `src/lib/rank-engine/engine.ts` (`rankProgress`)
**Finding:** Iterates every day of the rank window (up to 730 days for S-rank) on every call, and expects the caller to supply all `Goal`/`GoalEntry` rows up front. This is intentional per ADR-001 ("always recomputable from raw entries, no drift bugs from stored counters") — not a bug in the engine itself.
**Guardrail:** The engine's design is accepted. What's **not yet decided** is the query that feeds it. **When wiring this to Supabase in Phase 1, the fetch MUST be scoped `WHERE date >= window_start` (and by user), never "pull all entries for the user."** Flag this explicitly in the Phase 1 PR/ADR that implements the dashboard data-fetching layer — this is the concrete guardrail, not a suggestion to change the engine.

### SC2. No pagination pattern established for goal/entry lists
**Status:** OPEN (not yet relevant — no list UI exists)
**Guardrail:** Before Phase 1's dashboard ships a goal/entry list view, decide a pagination or windowing approach up front rather than shipping an unbounded query and retrofitting later.

### SC3. `rankProgress` is quadratic in window length × entry count
**Status:** OPEN (round-2 audit — sharpens SC1 with a concrete cost)
**Where:** `src/lib/rank-engine/engine.ts` — `rankProgress` loops day-by-day, and each iteration calls `dailyCompletion`, which runs `entries.filter(...)` over the **entire** entry array.
**Finding:** SC1 records that the window is recomputed on every call; this is the cost of that, quantified. The work is O(days × goals × entries), and entries themselves grow with days × goals. For a late-stage S-rank window (730 days, 3 daily goals ≈ 2,190 entries) a single `rankProgress` call is on the order of **1.6M array operations** — on every dashboard render, per user. Not a problem at Phase 0 scale with zero real data, and it is genuinely invisible in the current test suite, which uses fixtures of a handful of entries.
**Guardrail:** Index entries once per call before the loop (e.g. group into a `Map<date, GoalEntry[]>`, turning the inner scan into a lookup) rather than re-filtering the full array per day. That is a local change to the engine and does **not** compromise ADR-001's "always recomputable from raw entries" principle — it changes the access pattern, not the source of truth. Pair it with SC1's query-scoping guardrail so the data handed in is bounded too. **General rule: a pure function is not automatically a cheap one — when a loop calls a helper that scans a collection, check whether the scan can be hoisted out of the loop.**

---

## SDLC Practices

### D1. No CI pipeline
**Status:** FIXED — added `.github/workflows/ci.yml` (lint, `tsc --noEmit`, `npm test` on push/PR to `main`).
**Where:** repo root — no `.github/workflows/`, no pre-commit hook.
**Finding:** `tsc --noEmit`, `eslint`, `vitest run` all pass locally, but nothing enforces this on push/PR. CLAUDE.md explicitly mandates a TDD workflow ("write failing tests first... review and pressure-test agent-written code before merging — don't accept on trust"), and this is the one place doc and practice diverge: the mandate exists, but nothing automated checks it.
**Guardrail:** Add a minimal `.github/workflows/ci.yml` running `npm run lint`, `tsc --noEmit`, and `npm test` on every push/PR **before Phase 1 adds more surface area**. Until this exists, any session merging code is responsible for manually running all three checks — this document is the reminder that "tests pass locally" is not yet a bot-verified claim.

### D2. Single commit, large uncommitted working tree
**Status:** FIXED — Phase 0 restructured into incremental per-slice commits (`1c4a5a7`..`8b5d1fb`: deps, CLAUDE.md, schemas, rank engine, ADR-002 fix, migrations, auth infra, `.gitignore` fix, onboarding flow, audit doc, CI, rate limiting).
**Finding:** All of Phase 0 (auth, engine, migrations, ADRs) sat uncommitted on top of the single `Initial commit from Create Next App`.
**Guardrail:** Land Phase 0 as incremental, reviewable commits — one per ADR or per vertical slice (matching the TDD workflow's own granularity: failing test → implementation → refactor, each committed) — rather than one giant commit. Apply this going forward for Phase 1+ too: **commit at the same granularity the TDD workflow describes, not at the end of a whole phase.** (This is the pattern subsequent audit-fix commits, e.g. S1's `8b5d1fb`, already followed.)

### D3. ADR-002 pseudocode has a known-wrong pause formula that was never corrected in the ADR
**Status:** FIXED — `docs/adr/002-rank-streak-pause.md`'s `startPause` pseudocode now reads `today + days - 1`; the now-redundant deviation comment in `engine.ts` was trimmed to a plain reference.
**Where:** `docs/adr/002-rank-streak-pause.md` (pseudocode: `paused_until = today + days`) vs. `src/lib/rank-engine/engine.ts:148-154` (correctly implements `today + days - 1`, with an inline comment explaining the deviation and citing the ADR's own test requirement that a 7-day pause must cover exactly 7 days, day 1 through day 7).
**Finding:** The implementation is correct and the divergence is well-documented in code — good instinct. But per CLAUDE.md's own source-of-truth hierarchy, ADRs are supposed to be authoritative and durable; leaving the ADR wrong means a future session (agent or human) reading the ADR first, without noticing the code comment, could "fix" the correct code back to match the buggy doc.
**Guardrail:** **Whenever an implementation deliberately deviates from its ADR's pseudocode/spec, the ADR itself must be corrected in the same change — not just explained in a code comment.** A code comment documents *why* the code differs; it does not stop the next session from trusting the ADR over the code. Fix `docs/adr/002-rank-streak-pause.md`'s formula now as part of closing this item.

### D4. `next dev` mutates the tracked `CLAUDE.md` on every run
**Status:** FIXED — committed the injected `<!-- BEGIN:nextjs-agent-rules -->` block once so it stops showing up as a phantom diff.
**Where:** `CLAUDE.md` — Next.js appends a `<!-- BEGIN:nextjs-agent-rules -->` … `<!-- END:nextjs-agent-rules -->` block (written by `node_modules/next/dist/server/lib/generate-agent-files.js`).
**Finding:** Simply running `npm run dev` produces an uncommitted modification to a tracked, human-authored file. Next.js re-adds the block if removed, so reverting it just recreates the diff on the next dev run. Surfaced during the review session as a spurious `M CLAUDE.md` that was easy to mistake for someone's edit.
**Guardrail:** Commit the injected block once so the working tree stays clean, rather than repeatedly reverting it. **General rule: when a tool writes into a tracked file as a side effect of a normal dev command, either commit its output or ignore it deliberately — don't leave it as a permanent phantom diff that every future session has to re-investigate.**

### D5. CI does not run `next build`
**Status:** OPEN (round-2 audit)
**Where:** `.github/workflows/ci.yml` — runs lint, `tsc --noEmit`, and `npm test`, but never builds.
**Finding:** None of the three gates catch a build-breaking change. `next.config.ts` is not type-checked into the app graph the way route code is, route-level build errors surface only at build time, and static generation runs only during a build. This is not hypothetical for this repo: the S7/S8/S9 CSP work edited `next.config.ts` directly, and CI as configured would have gone green on a config that failed to build.
**Guardrail:** Add a build step to CI. It needs the two `NEXT_PUBLIC_SUPABASE_*` variables present — dummy placeholder values are sufficient, since `src/lib/supabase/env.ts` only asserts they are non-empty and no network call happens at build time. **General rule: the CI gate should run every check that can fail the deploy; "lint + types + tests pass" is not the same claim as "this deploys."**

### D6. CI workflow lacks least-privilege permissions and pinned actions
**Status:** OPEN (round-2 audit, hardening)
**Where:** `.github/workflows/ci.yml`.
**Finding:** No `permissions:` block, so the job inherits the repository default `GITHUB_TOKEN` scope, which is broader than this workflow needs (it only reads code). Actions are referenced by mutable tag (`actions/checkout@v4`, `actions/setup-node@v4`) rather than pinned to a commit SHA, so a compromised or retagged release would execute in CI. There is also no `concurrency` group, so superseded pushes keep burning runners.
**Guardrail:** Add `permissions: contents: read` at workflow level, pin third-party actions to full commit SHAs (with the version in a trailing comment for readability), and add a `concurrency` group keyed on the ref with `cancel-in-progress: true`. **General rule: a CI workflow is executable code with credentials — scope its token to what it actually needs and pin what it runs, the same as any dependency.**

### D7. Test surfaces that the project's own docs mandate are missing
**Status:** OPEN (round-2 audit)
**Where:** `src/lib/` — only `rank-engine/engine.test.ts` and `rate-limit.test.ts` exist.
**Finding:** Two explicitly-required test surfaces have no tests at all:
- **Zod schema validation.** CLAUDE.md's TDD workflow names it directly: *"write failing tests first (Zod schema validation, streak-calc, rank-window logic...)"*. `src/lib/schemas/*.ts` has zero tests — including the `targetDate >= startDate` refinement, the paired-null pause refinement, and S3's `rankTargetSchema`/DB-constraint alignment, which is exactly the kind of drift a test would pin.
- **RLS isolation.** ADR-003's test surface is unambiguous: *"user A cannot select/update/delete user B's goals, entries, or rank window, even with a directly-crafted query — test against the real database, not mocked."* Nothing covers this. RLS is the actual security boundary of the whole app (ADR-003 chose it precisely because app-layer filtering is easy for an agent to get wrong), and it is currently asserted only by reading the migration SQL — including by this audit.
**Guardrail:** Treat a documented test surface as part of the definition of done for the slice that introduces it. RLS tests need a running local Supabase (`supabase start`) and two real users, so they will not fit the current pure-unit `vitest` setup — decide whether they run as a separate integration project/command and wire that into CI, rather than deferring indefinitely. **General rule: when an ADR specifies a test surface, the slice implementing that ADR is not done until those tests exist or the ADR is amended to drop them — otherwise the ADR quietly becomes aspirational.**

---

## Not flagged (checked, confirmed fine — recorded so it isn't re-audited from scratch)

- RLS policies complete and uniform across all 4 tables, including the join-through pattern for `goal_entries`/`milestones`.
- No `service_role` key touches client or server code — only the anon key is used anywhere.
- Server/browser Supabase clients correctly share the same RLS boundary per ADR-003 (no "trusted server" bypass path).
- `src/proxy.ts` middleware matcher correctly excludes static assets.
- Migrations have proper indexes (`goals_user_id_idx`, `goal_entries_goal_id_date_idx`, `rank_windows_user_id_idx`) and `ON DELETE CASCADE` on all foreign keys.
- Test suite (`src/lib/rank-engine/engine.test.ts`) covers the exact surface ADR-002 specifies: grace boundary (2 vs. 3 misses), pause boundary (day 1 and day 7), streak-pause interaction.

**Secret / leak sweep — re-verified 2026-08-18 (review session), after `.env.local.example` became tracked via S4:**
- No secrets anywhere in git history or the working tree. Scanned all commits and all non-`node_modules` files for JWT-shaped strings (`eyJ…`), `sb_secret`, `service_role`, `SUPABASE_SERVICE_ROLE`, `sk-…`, and PEM headers. Only matches were the literal *word* `service_role` in comments/docs and a coincidental `eyJ` substring inside an npm integrity hash in `package-lock.json` — both benign.
- `.env.local.example` (now tracked) contains **empty placeholder values only** — no real project URL or key. Safe to be public.
- `.env.local` does not exist on disk and is correctly matched by `.gitignore`'s `.env*`.
- `supabase/config.toml` is safe to commit: every secret slot uses `env(...)` substitution (e.g. `auth_token = "env(SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN)"`), zero literal credentials.
- Build, `tsc --noEmit`, `eslint`, and `vitest` (16/16) all green at the time of review.

**Round-2 audit re-verification (2026-08-18), after Supabase project linking, S1/S5 and the CSP work:**
- **Secret sweep still clean** across all commits and the working tree — no JWT-shaped strings, `sb_secret`, `SUPABASE_SERVICE_ROLE`, `sk-…`, PEM headers, or `postgres://` connection strings.
- **`supabase/.temp/` is correctly ignored** — including `pooler-url`, `linked-project.json`, and `project-ref`, which appeared once a real project was linked. Verified with `git check-ignore`, and `git ls-files supabase/` lists only `.gitignore`, `config.toml`, and the two migrations.
- **`.env.local` now exists on disk** (real project credentials) and is correctly ignored. It contains only `NEXT_PUBLIC_*` variables — no service-role key. The anon key being public is correct by design: RLS is the boundary (ADR-003), not key secrecy.
- **No service-role key is referenced anywhere in `src/`.**
- `AGENTS.md` (written by the Vercel CLI at login, committed in `bc77048`) is generic platform guidance — no project identifiers or secrets.
- **`x-forwarded-for` trust in `src/lib/request-ip.ts` is CORRECT on Vercel — not a spoofing hole.** This was checked against Vercel's docs rather than assumed: *"Vercel overwrites this header and does not forward external IPs to prevent spoofing, unless a trusted proxy is enabled for Enterprise customers."* The leftmost-value `split(",")[0]` read is therefore safe **on this deploy target specifically**. The general web-security instinct here ("XFF is client-controlled, so the leftmost entry is spoofable") is right in most deployments and wrong on Vercel — worth recording so a future audit does not re-flag it, and so the platform dependency is visible if the target ever changes (see S11).
- Build, `tsc --noEmit`, `eslint`, and `vitest` (22/22) all green from the clean committed state.

---

## How to use this file going forward

- When starting new work, skim the `OPEN` items relevant to the area being touched (e.g. touching `src/lib/schemas/*` → check S3, M2).
- When an item is fixed, change its Status to `FIXED` and leave the Guardrail text in place — it's the reusable rule, not a description of the one-time fix.
- When a new finding surfaces (self-audit, code review, or a bug caught in the wild), add it here in the same format: **Finding** (what and where) + **Guardrail** (the rule that prevents recurrence, phrased so it applies to future code, not just this instance).
- This file is a supplement to the ADRs, not a replacement — structural decisions still belong in `docs/adr/`; this file tracks process/quality gaps and the rules meant to close them.

### Session split: who writes what

Work on this project runs across two Claude sessions with deliberately separate roles. Keep them separate — the value of the review is that it is independent of the implementation.

- **Implementation session (main thread)** — owns *all* code changes, commits, and **Status updates in this file**. When it fixes an item, it flips that item's Status to `FIXED` and appends what was actually done. It never marks its own work reviewed.
- **Review session** — owns *findings only*. It adds new entries (Finding + Guardrail + evidence) and appends **Review note** lines to existing entries, but does **not** fix code and does **not** flip Status to `FIXED`. Its job is to independently verify claims rather than accept them, per CLAUDE.md's "review and pressure-test agent-written code before merging — don't accept on trust."

Practical consequence: an item marked `FIXED` means *implemented*, not *verified*. A separate **Review note** on the entry is what records independent verification — and, as S7/S8/S9 showed (a correctly-present CSP header that still broke the OAuth flow), "implemented" and "actually works end-to-end" are not the same claim.

### Concurrency: when to touch shared state, not just who

The role split above says *who* writes what. It says nothing about *when*, and that gap is real: the S7/S8/S9 round landed safely only because the two sessions happened to edit different regions of this file — Status lines vs. Review notes below them. That was luck. If both had rewritten the same entry, one edit would have silently clobbered the other, and a tool reporting "the edit applied cleanly" only confirms *your* write landed, not that the other session's content survived it.

- **The review session waits for an explicit "done" signal from the implementation session before editing shared files or running builds.** A file changing (e.g. `next.config.ts`) means work *started*, not finished — don't treat a watched file's mtime as a completion signal.
- **The implementation session sends that signal when a coherent unit is finished and committed.** Committed, not just saved — a commit is the unambiguous handoff point and gives the reviewer a stable state to verify against instead of a moving target.
- **Neither session runs destructive or shared-state commands — `rm -rf .next`, rebuilds, dev servers on shared ports — while the other holds the work.** These clobber build caches and generated types out from under whoever is mid-verification (this happened: a review session's `rm -rf .next` plus a leftover probe route left stale generated types that surfaced as spurious `tsc` failures in `src/app/csptest/*`, attributable to the wrong session if not traced back).
- **If a session must touch a shared file it doesn't own for the task at hand, it re-reads immediately before editing, and verifies afterward that the other session's content is still intact** — not just that its own edit applied.

**General rule:** two agents editing the same file concurrently is not made safe by them happening to edit different regions of it — that's luck, not a guarantee. Serialize on an explicit handoff (commit = done), and verify the merge afterward rather than assuming a clean apply.
