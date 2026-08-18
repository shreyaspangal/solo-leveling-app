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
**Status:** OPEN
**Where:** `src/app/login/actions.ts`, `src/app/signup/actions.ts`
**Finding:** Both actions call Supabase directly with no app-layer throttling. Brute-force/credential-stuffing protection currently relies entirely on Supabase's own rate limits, which are local-dev defaults (`supabase/config.toml`), not verified production values.
**Guardrail:** Before any auth action ships past Phase 0, run it through the `api-rate-limiting` skill and confirm production Supabase rate-limit values explicitly (don't assume local `config.toml` defaults carry over). Any new server action that accepts credentials or triggers an email/SMS send gets the same check.

### S2. No security headers configured
**Status:** OPEN
**Where:** `next.config.ts`
**Finding:** Empty config — no CSP, `X-Frame-Options`, `Referrer-Policy`, HSTS, etc.
**Guardrail:** Add a headers block before first public deployment (not required for local dev). Track as a pre-deploy checklist item, not a Phase 0 blocker.

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
**Status:** OPEN (config, not code)
**Where:** Supabase project dashboard (not in-repo — `supabase/config.toml` is local-dev only)
**Finding:** Local config has `enable_confirmations = false` for email and no CAPTCHA. Fine for local dev, but nothing in the repo enforces or even reflects what the *production* project has configured.
**Guardrail:** Before opening real signup to users, confirm on the actual Supabase project (not local config): email confirmation **on**, leaked-password protection **on**, CAPTCHA/rate limits tuned. Add this as an explicit pre-launch checklist step — `config.toml` values must never be assumed to match production.

### S6. Auth error messages passed through to the UI unfiltered
**Status:** ACCEPTED (monitor, not fixing now)
**Where:** `src/app/login/actions.ts`, `src/app/signup/actions.ts` (`error.message` rendered directly)
**Finding:** Supabase's own error messages are generally safe to show, but there's no normalization layer — if a misconfigured project ever returns something more detailed, it renders unfiltered.
**Guardrail:** No action needed now. If a future session adds a new Supabase-backed action that surfaces `error.message` to the client, sanity-check the message isn't leaking internal state (table names, stack traces) before shipping it as-is.

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

---

## SDLC Practices

### D1. No CI pipeline
**Status:** FIXED — added `.github/workflows/ci.yml` (lint, `tsc --noEmit`, `npm test` on push/PR to `main`).
**Where:** repo root — no `.github/workflows/`, no pre-commit hook.
**Finding:** `tsc --noEmit`, `eslint`, `vitest run` all pass locally, but nothing enforces this on push/PR. CLAUDE.md explicitly mandates a TDD workflow ("write failing tests first... review and pressure-test agent-written code before merging — don't accept on trust"), and this is the one place doc and practice diverge: the mandate exists, but nothing automated checks it.
**Guardrail:** Add a minimal `.github/workflows/ci.yml` running `npm run lint`, `tsc --noEmit`, and `npm test` on every push/PR **before Phase 1 adds more surface area**. Until this exists, any session merging code is responsible for manually running all three checks — this document is the reminder that "tests pass locally" is not yet a bot-verified claim.

### D2. Single commit, large uncommitted working tree
**Status:** OPEN (process, not a defect)
**Finding:** All of Phase 0 (auth, engine, migrations, ADRs) sits uncommitted on top of the single `Initial commit from Create Next App`.
**Guardrail:** Land Phase 0 as incremental, reviewable commits — one per ADR or per vertical slice (matching the TDD workflow's own granularity: failing test → implementation → refactor, each committed) — rather than one giant commit. Apply this going forward for Phase 1+ too: **commit at the same granularity the TDD workflow describes, not at the end of a whole phase.**

### D3. ADR-002 pseudocode has a known-wrong pause formula that was never corrected in the ADR
**Status:** FIXED — `docs/adr/002-rank-streak-pause.md`'s `startPause` pseudocode now reads `today + days - 1`; the now-redundant deviation comment in `engine.ts` was trimmed to a plain reference.
**Where:** `docs/adr/002-rank-streak-pause.md` (pseudocode: `paused_until = today + days`) vs. `src/lib/rank-engine/engine.ts:148-154` (correctly implements `today + days - 1`, with an inline comment explaining the deviation and citing the ADR's own test requirement that a 7-day pause must cover exactly 7 days, day 1 through day 7).
**Finding:** The implementation is correct and the divergence is well-documented in code — good instinct. But per CLAUDE.md's own source-of-truth hierarchy, ADRs are supposed to be authoritative and durable; leaving the ADR wrong means a future session (agent or human) reading the ADR first, without noticing the code comment, could "fix" the correct code back to match the buggy doc.
**Guardrail:** **Whenever an implementation deliberately deviates from its ADR's pseudocode/spec, the ADR itself must be corrected in the same change — not just explained in a code comment.** A code comment documents *why* the code differs; it does not stop the next session from trusting the ADR over the code. Fix `docs/adr/002-rank-streak-pause.md`'s formula now as part of closing this item.

---

## Not flagged (checked, confirmed fine — recorded so it isn't re-audited from scratch)

- RLS policies complete and uniform across all 4 tables, including the join-through pattern for `goal_entries`/`milestones`.
- No `service_role` key touches client or server code — only the anon key is used anywhere.
- Server/browser Supabase clients correctly share the same RLS boundary per ADR-003 (no "trusted server" bypass path).
- `src/proxy.ts` middleware matcher correctly excludes static assets.
- Migrations have proper indexes (`goals_user_id_idx`, `goal_entries_goal_id_date_idx`, `rank_windows_user_id_idx`) and `ON DELETE CASCADE` on all foreign keys.
- Test suite (`src/lib/rank-engine/engine.test.ts`) covers the exact surface ADR-002 specifies: grace boundary (2 vs. 3 misses), pause boundary (day 1 and day 7), streak-pause interaction.
- No secrets committed anywhere in git history.

---

## How to use this file going forward

- When starting new work, skim the `OPEN` items relevant to the area being touched (e.g. touching `src/lib/schemas/*` → check S3, M2).
- When an item is fixed, change its Status to `FIXED` and leave the Guardrail text in place — it's the reusable rule, not a description of the one-time fix.
- When a new finding surfaces (self-audit, code review, or a bug caught in the wild), add it here in the same format: **Finding** (what and where) + **Guardrail** (the rule that prevents recurrence, phrased so it applies to future code, not just this instance).
- This file is a supplement to the ADRs, not a replacement — structural decisions still belong in `docs/adr/`; this file tracks process/quality gaps and the rules meant to close them.
