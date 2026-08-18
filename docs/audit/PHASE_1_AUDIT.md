# Phase 1 Audit — Findings & Guardrails

**Scope:** Phase 1's Quests vertical slice (create → track → streak → rank contribution) and Home
Dashboard v1, per `CLAUDE.md`'s build order.

Same format and roles as `docs/audit/PHASE_0_AUDIT.md` — see that file's "Session split: who
writes what" and "Concurrency: when to touch shared state, not just who" sections for the
implementation/review role split and the commit-is-the-handoff-signal rule. Not repeated here to
avoid two copies of the same convention drifting apart; if either process changes, change it there
and this file inherits it.

## What's different from the Phase 0 rounds: per-slice cadence, not per-phase

Phase 0's audit ran in batched rounds — several commits landed, then a review pass covered all of
them at once. For Phase 1, the project owner asked for a tighter loop specifically so bugs aren't
discovered only at the end, the way C1-C5's chain of "the fix reveals the next conflation" played
out in Phase 0: **one slice, then a full stop for review, before the next slice starts.**

Concretely, per slice:
1. Implementation session builds the slice (TDD per `CLAUDE.md`'s workflow), gets tsc/lint/test/
   build green locally, commits, pushes, confirms CI is green.
2. Implementation session sends the review session an explicit done signal naming the slice (not
   just "I pushed something" — which slice, what commits).
3. Review session audits that slice specifically against its own goal (see the slice list below)
   and this doc's usual bar — findings go in this file, no code changes, same as Phase 0.
4. Any findings get fixed and re-verified (same fix → done-signal → re-verify loop as Phase 0's
   later rounds) **before the next slice's implementation starts**, not batched.

## Slice tracker

Status of each slice's audit, updated as work proceeds. `PENDING` = not built yet · `AWAITING REVIEW`
= built, done signal sent, review not back yet · `IN REVIEW` = review session is actively on it ·
`CLEAR` = reviewed, no blocking findings (or all findings from that slice's round fixed and
re-verified) · findings themselves get their own `###` entries below, same as Phase 0's `S`/`C`/etc.

| # | Slice | Status |
|---|---|---|
| 1 | Goal creation (Zod-validated `createGoal` action + minimal form) | AWAITING REVIEW |
| 2 | Entry tracking (`upsertGoalEntry` action + today's-quests checklist) | PENDING |
| 3 | Rank engine data wiring (scoped Supabase fetch → engine, per SC1/SC3's guardrail) | PENDING |
| 4 | Home Dashboard v1 (assembles 1-3 into the real `/dashboard` page) | PENDING |

Explicitly out of scope for this pass, not oversights: goal editing/deletion, milestones, the
global date filter (Phase 3 per `CLAUDE.md`). Flagged here so neither session re-raises them as
missing coverage.

---

## Findings

### P1-1. "Today" is a UTC day everywhere, so a user's day rolls over mid-afternoon
**Status:** OPEN — **decide before Slice 2 builds entry tracking; this is the last cheap moment.**
**Slice:** 1 (surfaced here) — **but the cost lands in Slice 2.**
**Where:** `src/app/quests/new/new-quest-form.tsx:21` and `src/app/setup/actions.ts:19`, both `new Date().toISOString().slice(0, 10)`. No timezone handling exists anywhere in `src/` (grepped: the only matches are two comments in the rank engine noting dates are UTC).
**Finding:** The app derives "today" from `toISOString()`, i.e. the **UTC** calendar day, while users read dates on their local clock. The rank engine's UTC-normalized date handling is a deliberate, sound decision for *arithmetic* (`date-utils.ts` explains why). What was never decided is what a "day" means to the *user*. Measured — when the app's day actually rolls over on each user's local clock:

| Timezone | app's day flips at local |
|---|---|
| Pacific/Auckland | **12:00 (noon)** |
| Asia/Kolkata | 05:30 |
| Europe/London | 01:00 |
| America/New_York | 20:00 (previous evening) |
| America/Los_Angeles | **17:00 (previous evening)** |

Concretely: a Los Angeles user marking a quest done at **6pm on Tuesday local** writes to **Wednesday's** row. An Auckland user's afternoon belongs to the next day. Only users in a narrow band around UTC see the boundary land near their own midnight, and it is invisible when testing from a UTC-ish machine or a Vercel runner.

Two distinct consequences, worth separating:
1. **Slice 1 (mild, live now):** the form's default `startDate` can be off by one against the user's local today. For a `weekly` goal that also shifts which weekday it recurs on forever, since `scheduledOn` keys the cadence off `start_date`'s weekday.
2. **Slice 2 (the real cost, not yet built):** entry tracking is entirely built on "which day is today". Every completion, every streak boundary, and every grace decision inherits this. A user who does their evening routine after their local rollover silently logs it to tomorrow — and then *both* days read as incomplete, breaking a streak they actually earned. That is the exact failure mode ADR-002 calls "a silent bug misrepresenting a user's real progress", which CLAUDE.md singles out as the thing to pressure-test hardest.
**Guardrail:** Decide the day-boundary rule explicitly and write it down before Slice 2 encodes it — this is a product decision (whose midnight counts?), not an implementation detail, so it belongs in an ADR-002 addendum or its own ADR alongside the rest of the day semantics. The realistic options are (a) store a per-user IANA timezone and compute "today" in it, (b) keep UTC days but say so in the UI so the boundary isn't a surprise, or (c) derive the day from the client's local date and send it with the write. **General rule: any app whose core unit is "a day" has to name whose midnight it means; leaving it implicit doesn't avoid the decision, it just makes UTC the answer by default and hides it until users are in other timezones.**

### P1-2. `createQuest` returns raw Postgres errors to the user
**Status:** FIXED — added `src/lib/errors.ts`'s `toUserError(error, context)`: logs the real error server-side (tagged with the calling action's name), returns a generic message to the client. `createQuest` now uses it; the guardrail's "through the same utility, not a copy" applies to Slice 2's `upsertGoalEntry` too. 2 new tests. Commit `fe5eb51`.
**Slice:** 1
**Where:** `src/app/quests/actions.ts:61-63` — `if (error) { return { error: error.message }; }`, rendered directly by `new-quest-form.tsx:97`.
**Finding:** Any database-level failure is surfaced verbatim. A check-constraint violation renders as something like `new row for relation "goals" violates check constraint "goals_frequency_check"` — which names the table and constraint, and is meaningless to the person reading it. This is precisely the case Phase 0's **S6** guardrail was written to catch: *"If a future session adds a new Supabase-backed action that surfaces `error.message` to the client, sanity-check the message isn't leaking internal state (table names, stack traces) before shipping it as-is."* S6 was accepted-and-monitored for the auth actions because Supabase Auth's own messages are user-facing by design; a raw PostgREST/Postgres error is not. Low severity — schema names aren't secrets and Zod catches the reachable invalid inputs first, so this fires mainly on genuine server faults — but it is a documented guardrail firing on new code.
**Guardrail:** Log the real error server-side, return a generic message to the client. Apply it to every new data-mutating action rather than per-action, so Slice 2's `upsertGoalEntry` doesn't repeat it — the S1 rate-limit guardrail's "through the same utility, not a copy of the logic" shape applies here too.

### P1-3. Three form inputs have no associated `<label>`
**Status:** FIXED — `title`/`description`/`category` now have `<label htmlFor>`, matching the existing `frequency`/`startDate`/`targetDate` pattern. Tried making this mechanical via `jsx-a11y/control-has-associated-label` per the guardrail's suggestion, then reverted: the rule's source only recognizes nested/aria-based labeling, not external `htmlFor`/`id` association — confirmed by testing it against the already-correct `startDate`/`targetDate` fields, which it flagged anyway. Enforcing it would have meant redundant `aria-label`s project-wide for no real signal, so it stays a code-review-discipline item rather than a lint gate. Commit `fe5eb51`.
**Slice:** 1
**Where:** `src/app/quests/new/new-quest-form.tsx` — `title` (25-33), `description` (34-40), `category` (41-48) rely on `placeholder` alone.
**Finding:** `frequency`, `startDate` and `targetDate` all have proper `<label htmlFor>`; the first three don't, so the form is internally inconsistent. A placeholder is not an accessible name — it isn't reliably announced by screen readers, and it vanishes as soon as the field has content, so the field loses its visible name exactly when a user is reviewing what they typed. Not caught by lint (`eslint-config-next` doesn't enable `jsx-a11y/label-has-associated-control`). CLAUDE.md commits to a "clean, functional, responsive" interface through Phase 2, and labelled inputs are part of functional rather than part of visual polish — this isn't the deferred visual-identity work.
**Guardrail:** Label every input, or attach `aria-label` where a visible label would genuinely duplicate an adjacent heading. Worth enabling the `jsx-a11y` label rule in `eslint.config.mjs` so the check is mechanical rather than dependent on review — the form grows in Slices 2 and 4.

### P1-4. Nothing bounds how many goals a user can create
**Status:** OPEN (low now, compounds later — flagged early rather than after it matters)
**Slice:** 1
**Where:** `src/app/quests/actions.ts` — no per-user count check; no rate limiting on the action.
**Finding:** `createQuest` can be called without limit. Phase 0's **S1** guardrail only mandates rate limiting for actions taking credentials or sending email/SMS, so this action is correctly out of that scope — but goal count is the multiplier in **SC3**'s cost (`rankProgress` is O(days × goals × entries)). A user with a few hundred goals makes their *own* dashboard expensive, and the engine work is unavoidable per ADR-001's recompute-from-raw-entries principle. It's self-inflicted rather than a cross-user DoS, and irrelevant at current scale.
**Guardrail:** Not worth fixing now. Worth deciding a sane per-user cap when Slice 3 wires the real fetch, at the same time as SC3's indexing work, since both are about the same "how much does one dashboard render cost" question. Recorded now so it's a considered decision then, not a surprise.

### P1-5. Login/signup's email and password fields have the same problem P1-3 fixed (Phase 0 code, not touched here)
**Status:** OPEN — deliberately not fixed in this slice
**Slice:** N/A — discovered while investigating P1-3, affects Phase 0 files (`src/app/login/page.tsx`, `src/app/signup/page.tsx`)
**Where:** `src/app/login/page.tsx` (`email`, `password` inputs), `src/app/signup/page.tsx` (`name`, `email`, `password` inputs) — all placeholder-only, no `<label>`.
**Finding:** While attempting to enable `jsx-a11y/control-has-associated-label` for P1-3, the rule also flagged these Phase 0 fields. The rule itself turned out to be unreliable as a mechanical gate (see P1-3's resolution — it doesn't recognize `htmlFor`/`id` association at all, and flagged already-correctly-labeled fields too), so its output isn't trustworthy evidence on its own. But reading the actual markup confirms this specific case is real, not a rule artifact: these fields rely on `placeholder` alone, the exact same pattern P1-3 just fixed in `new-quest-form.tsx`. Not fixed here — touching Phase 0 files as a side effect of a Phase 1 slice's lint investigation is scope creep this slice didn't need, and those files have already been through their own audit rounds.
**Guardrail:** Fix the same way P1-3 did (`<label htmlFor>` per field) whenever login/signup is next touched for an unrelated reason, or as a small standalone cleanup — not urgent, but real. **General rule: when investigating a lint rule for a new file, cross-check its findings against a rule you trust before generalizing — this rule's false positives (correctly-labeled `startDate`/`targetDate`) could have masked its true positives (these fields) if the output had been accepted wholesale instead of verified.**

---

## Not flagged

**Slice 1 — verified, so it isn't re-checked next round:**
- **`user_id` comes from the session, never client input** — confirmed at `actions.ts:49-50`: `user.id` from `supabase.auth.getUser()`, and `formData` is never consulted for it. The inline comment correctly notes RLS's `WITH CHECK` would reject a mismatch anyway but shouldn't be the only thing standing there — that's the right posture, defence in depth rather than relying on the database alone.
- **Zod ↔ DB constraint alignment** — checked directly rather than taken on trust: `domainSchema`/`frequencySchema` enums match the `goals` table's `check (domain in ...)` / `check (frequency in ...)` exactly. Length caps (`title` 200, `category` 100, `description` 2000) exist only in Zod against `text` columns, i.e. the schema is stricter than the DB, which is the safe direction and consistent with **S3**'s guardrail.
- **`createGoalSchema` is genuinely test-covered** — `goal.test.ts` from D7, unchanged this slice, including the `targetDate >= startDate` refinement this form can trigger.
- **Auth guard works in a browser, not just in the code** — `curl` against a running dev server returns `307` to `/login` for an unauthenticated `GET /quests/new`.
- **`domain` is hardcoded server-side**, not a form field, so the Quests route can't be repurposed to write another domain by crafting a request.
- **FormData edge handling is correct** — blank optional fields (`""`) normalize to `null` rather than being stored as empty strings, and the unchecked-checkbox case (absent from FormData entirely) is handled explicitly.

**Browser verification of the authenticated form UI — NOT done, and not something I can do unilaterally.** The Playwright lock that blocked the implementation session has been released (it was a stale session on this side), so that obstacle is gone. But reaching the form requires an authenticated session, and both routes there have a problem: Docker is unavailable on this machine, so there's no local Supabase to sign into, and the only other option is creating a test account in the **real linked production project** — which is exactly the kind of external side effect the D8 guard exists to prevent for the RLS suite, and not something to do without the project owner's say-so. So the specific items requested — checkbox/select/date-input behavior and error display on invalid submission — remain unverified by either session. Flagged for the owner to choose: enable Docker for a local stack, or authorize a disposable test account.
