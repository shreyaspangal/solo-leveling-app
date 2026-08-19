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
`BLOCKED (browser access)` = code-level review passed, but browser/UI verification could not be
completed — auth-gated routes need a signed-in session, and neither Docker (local Supabase) nor a
disposable test account in the linked project is currently available/authorized; see the note below
· `CLEAR` = reviewed, no blocking findings (or all findings from that slice's round fixed and
re-verified), **including a completed browser pass** · findings themselves get their own `###`
entries below, same as Phase 0's `S`/`C`/etc.

| # | Slice | Status |
|---|---|---|
| 1 | Goal creation (Zod-validated `createGoal` action + minimal form) | **CLEAR** — GREEN verdict 2026-08-19; see "Slice 1 — final review verdict" below |
| 2 | Entry tracking (`upsertGoalEntry` action + today's-quests checklist) | AWAITING REVIEW — commit `e6cfa67` |
| 3 | Rank engine data wiring (scoped Supabase fetch → engine, per SC1/SC3's guardrail) | PENDING |
| 4 | Home Dashboard v1 (assembles 1-3 into the real `/dashboard` page) | PENDING |

**Browser access blocker — resolved (2026-08-19).** Docker is now installed and working on this
machine (see the project owner's decision to enable it locally, over the disposable-test-account
alternative). Local Supabase (`supabase start --exclude storage-api` — Storage's health check
failed repeatedly and nothing in the app uses it yet; excluded rather than debugged) is up and
independently verified by the implementation session: the RLS integration suite passes locally for
the first time (8/8, not just via CI), and the browser Supabase client's compiled-bundle fix
(P1-9) was confirmed via a real `next build`. The review session separately obtained its own
browser access against this same local stack and found P1-7/P1-8/P1-9 through it. Local env vars
for whichever session needs them: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH` (from `supabase
status`, regenerated fresh by `supabase start` — not the linked project's real credentials).

Explicitly out of scope for this pass, not oversights: goal editing/deletion, milestones, the
global date filter (Phase 3 per `CLAUDE.md`). Flagged here so neither session re-raises them as
missing coverage.

---

## Findings

### P1-1. "Today" is a UTC day everywhere, so a user's day rolls over mid-afternoon
**Status:** FIXED — decided as a real product question, not picked unilaterally: presented three options (per-user timezone / UTC-with-disclosure / client-sends-the-day) with a recommendation to the project owner, who chose per-user timezone. Documented in **ADR-006** (`docs/adr/006-user-day-boundary.md`). Implementation: `src/lib/today.ts`'s `todayInTimezone(timezone, now)` (`Intl.DateTimeFormat("en-CA", { timeZone })`, no new dependency, deliberately kept out of `rank-engine/date-utils.ts` which stays pure UTC-anchored arithmetic); timezone captured client-side at the end of `/setup` (`Intl.DateTimeFormat().resolvedOptions().timeZone`, set on a hidden input at submit time via a ref rather than during render, to avoid a hydration mismatch between the server process's timezone and the browser's) and stored via `supabase.auth.updateUser({ data: { timezone } })` — Auth `user_metadata`, not a new table, per ADR-006's reasoning. `completeSetup`'s `window_start` and the quest form's default `startDate` both now use it (the latter via the browser's own `toLocaleDateString`, computed after mount, same hydration-safety reasoning). 7 new tests for `todayInTimezone` across the exact timezone set measured in this finding. Verified `updateUser`/`user_metadata` persistence against the real linked project (not just locally). 90/90 green. Commit `a41a234`.
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

### P1-6. ADR-006's timezone backfill is scoped out but tracked nowhere actionable
**Status:** FIXED (re-closed) — the design was always correct; P1-9 (the reason it didn't execute) is now fixed, so `TimezoneSync` can actually run. Re-verified past "the code looks right" the same way P1-9 was: the browser client's URL is now confirmed present in the compiled client bundle, which is the specific mechanism that was silently failing. Full browser-console confirmation that `TimezoneSync` completes without throwing on a real `/dashboard` load is the review session's to do next, per the process split — recorded as open verification, not claimed here.

*(Reopened by the review session with browser evidence on 2026-08-19 (see the preserved note below), because P1-9's underlying bug meant this fix never ran — a correctly-attributed, in-scope status correction per the doc's own exception for a misstated FIXED claim. Re-closed by the implementation session now that P1-9 is fixed, per the review session's own instruction to do so once fixed and re-verified.)*

**Original implementation note (unchanged):** FIXED — added `src/app/timezone-sync.tsx` (`TimezoneSync`, a client component rendering nothing), mounted in `/dashboard` — the hub every authenticated user passes through repeatedly. On mount, compares the browser's detected timezone against `user_metadata.timezone` and calls `supabase.auth.updateUser` only when they differ, so it's a no-op read-and-compare on every visit that doesn't need a write. Covers both pre-`a41a234` accounts (never captured) and a timezone that changes later (e.g. travel) — the latter wasn't the original ask but falls out of the same mechanism for free and stays within ADR-006's "auto-detected only" scope, not a manual-override feature.

Not added to Phase 0's Pre-Release Checklist as requested: the guardrail's own framing was "revisit if it matters before public launch," premised on the gap staying open until then. It doesn't stay open — this fix closes it now, in the same round it was found, so there's nothing left for a pre-launch checklist to track. `docs/adr/006-user-day-boundary.md`'s "Explicitly out of scope" list is updated to say so rather than left describing the pre-fix state. tsc/lint/test(90/90)/build clean. Commit `a3b01df`.
**Slice:** 1 (follow-on from P1-1's fix)
**Where:** `docs/adr/006-user-day-boundary.md` — "Explicitly out of scope: Backfilling `user_metadata.timezone` for accounts that completed setup before this ADR."
**Finding:** The fallback itself is right, and deciding not to backfill now is a reasonable call. The problem is bookkeeping: timezone is captured **only** at the end of `/setup`, which is a one-time onboarding step, so an account that finished onboarding before `a41a234` will *never* acquire a timezone through normal use — it falls back to UTC permanently and silently reproduces exactly the P1-1 behavior ADR-006 was written to fix. That already includes at least one real account (the one used to verify the `updateUser` write against the linked project). ADR-006 says "revisit if it matters before public launch," but that sentence lives only in an ADR's out-of-scope list — it isn't in Phase 0's **Pre-Release Checklist**, which is the doc that exists precisely so "must happen before real users" is one answerable list rather than something reconstructed by grepping guardrails.
**Guardrail:** Add it to the Pre-Release Checklist (blocking tier — it's a correctness issue for every pre-existing account, and the affected users are invisible because the fallback is silent). The fix itself is small: capture timezone on any authenticated request when `user_metadata.timezone` is absent, rather than only at setup. **General rule: "out of scope, revisit before launch" is only a real decision if it's written where launch readiness is actually tracked — an ADR's out-of-scope list is documentation, not a queue.**

---

### P1-7. P1-6's fix silently decides the "travelling user" question ADR-006 deferred
**Status:** FIXED (documentation) — added an addendum to ADR-006 stating the decision explicitly (auto-follow the detected timezone, no pinning to onboarding's) and its real consequence (a timezone shift crossing a day boundary mid-window can skip a day, read as a genuine miss rather than unscheduled). Accepted as a known tradeoff rather than built around right now, per CLAUDE.md's cheap-testing-first rationale — genuinely needs both a large offset and landing mid-streak. Fix path documented for if it matters later (treat a timezone-shift-skipped day as unscheduled, same rule C1/C4 established). No code change. Commit `b8e2638`.
**Slice:** 1 (follow-on from P1-6's fix, commit `a3b01df`)
**Where:** `src/app/timezone-sync.tsx` — refreshes `user_metadata.timezone` whenever the detected value differs from the stored one.
**Finding:** The backfill behavior is right and P1-6 is genuinely fixed by it. But the same comparison that backfills a *missing* timezone also silently re-points an *existing* one the moment the browser reports something different — and the component's own comment names this ("or whose browser's timezone changes, e.g. travel"). ADR-006 explicitly listed that under **Explicitly out of scope**: *"Letting a user manually override their detected timezone (e.g. if they travel) — auto-detected only, for now."* The ADR deferred the question; this fix answers it as "auto-follow", without the ADR being updated to say so.

That matters because a mid-window timezone change moves the day boundary underneath an in-flight streak. Flying LA→Auckland shifts "today" forward by ~19 hours, so a calendar day can be skipped entirely: it ends up with no entries, `dailyCompletion` reads it as a miss rather than as unscheduled, and the streak breaks through no fault of the user — the "silently misrepresents a user's real progress" failure mode again, just reached by a different route. The reverse direction is benign (the `unique (goal_id, date)` constraint means a repeated day upserts rather than duplicating).

Genuinely an edge case — it needs a user who both travels across enough offset to cross a date boundary and is mid-streak — and auto-following is defensible; the alternative (pinning to the onboarding timezone) is arguably worse for someone who relocates permanently. The issue is that it's now decided by implementation rather than by the ADR that explicitly declined to decide it.
**Guardrail:** Update ADR-006 to state the chosen behavior and its streak consequence, rather than leaving the ADR saying the question is out of scope while the code answers it — the D3 guardrail from Phase 0 applies verbatim here ("whenever an implementation deliberately deviates from its ADR, the ADR itself must be corrected in the same change"). If the streak consequence is unacceptable, the fix is to treat a day skipped purely by a timezone shift as unscheduled rather than missed, which is the `null`-is-neutral rule C1/C4 already established.

### P1-8. Every failed submission wipes the whole quest form
**Status:** FIXED — every field (`title`, `description`, `category`, `frequency`, `targetDate`, `dailyTracking`) is now controlled from local state, matching `startDate`'s existing pattern from P1-1. `name` attributes unchanged, so `createQuest` reads FormData exactly as before — `actions.ts` untouched. Nothing resets this state on a failed submission, so nothing gets wiped; a successful submission redirects away, so state no longer matters at that point. 93/93 tests green, tsc/lint/build clean. Full browser confirmation of the fixed error path (the original repro) is the review session's to do, per the process split — not claimed here. Commit `23aaa89`.
**Slice:** 1
**Where:** `src/app/quests/new/new-quest-form.tsx` — uncontrolled inputs under `<form action={formAction}>` (`useActionState`).
**Finding:** When the server action returns a validation error, React 19 resets the form on action completion, so **every uncontrolled field is cleared** while the error message is displayed. Reproduced deliberately against a real local stack: filled `title = "Meditate 10 minutes"`, a long `description`, `category = "Personal"`, and an intentionally invalid `targetDate = 2026-01-01`, then submitted. Result:

| field | before submit | after failed submit |
|---|---|---|
| `title` | "Meditate 10 minutes" | **""** |
| `description` | a full paragraph | **""** |
| `category` | "Personal" | **""** |
| `targetDate` | 2026-01-01 | **""** |
| `startDate` | 2026-08-19 | 2026-08-19 (survives) |
| `dailyTracking` | checked | checked (survives) |

`startDate` survives only because P1-1's fix happened to make it a *controlled* input (`value={today}` + `onChange`); `dailyTracking` survives because `defaultChecked` re-applies. Everything the user actually typed is gone.

The user-facing result is worse than losing input: the error says *"targetDate must be on or after startDate"* while pointing at a form where `targetDate` — and everything else — is now blank, so the message describes a state that no longer exists. This also produced a confusing artifact during review: a follow-up submit failed again because `title` had been silently emptied, not because of anything the user did.

This is the primary failure path of the only form in the slice, and it is invisible to every check that ran before now — unit tests don't render, `tsc`/lint/build don't execute forms, and the code reads correctly.
**Guardrail:** Return the submitted values in the action's state and feed them back as `defaultValue`, or make the fields controlled. **General rule: with React 19 server actions, a form's error path needs its input-retention behavior verified in a browser — the reset is framework behavior that no amount of reading the component reveals.** Applies directly to Slice 2's checklist and Slice 4's dashboard forms; worth fixing as a shared pattern once rather than per form.

### P1-9. The browser Supabase client can never initialize, so P1-6's fix never runs
**Status:** FIXED — `env.ts`'s `supabaseUrl()`/`supabaseAnonKey()` now each read their variable via a literal `process.env.NEXT_PUBLIC_X` property access instead of the shared `requireEnv(name)` dynamic-key helper; the duplication is the fix, not a pre-refactor step, since sharing a name-parameterized helper is exactly what reintroduces the dynamic-key access. Verified past "the code looks right": built with real env vars and grepped the compiled client bundle (`.next/static/chunks/`) for the literal local Supabase URL string — **confirmed present**, proving the bundler's static-inlining mechanism (the actual thing that was broken) now works. Full browser-console confirmation (the original repro) is the review session's to do — Playwright was in active use on their side when I checked, consistent with UI verification being their lane per the process change. New regression test (`env.test.ts`) is a source-pattern guard rather than a runtime one, since Vitest never exercises Next's build-time bundling — documented honestly in the test's own comment rather than claiming a jsdom test that wouldn't actually catch this class of bug. Also fixed in the same commit: `supabase/.temp/`'s minified edge-runtime vendor file was gitignored but not eslint-ignored (flat config doesn't read `.gitignore`), surfaced as 150+ errors the moment local Supabase first started this session. 93/93 tests green. Commit `994b7b6`.
**Slice:** 1 (P1-6 follow-on, commit `a3b01df`)
**Where:** `src/lib/supabase/env.ts` — `const value = process.env[name];` (dynamic key), reached from `src/lib/supabase/client.ts` → `TimezoneSync`.
**Finding:** Loading `/dashboard` throws in the browser console on every visit:

```
Error: Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL
    at requireEnv → supabaseUrl → createClient → TimezoneSync.useEffect
```

Next.js inlines `NEXT_PUBLIC_*` values into the client bundle only for **statically analyzable** access (`process.env.NEXT_PUBLIC_SUPABASE_URL`). `env.ts` reads them via a **dynamic** key, `process.env[name]`, which the bundler cannot substitute — confirmed in the page: `process` is not defined in the browser at all, so nothing can be read from it.

This was latent rather than new: Phase 0's **S9** review recorded that `src/lib/supabase/client.ts` "is not imported anywhere yet", which is exactly why it never surfaced. `TimezoneSync` is the browser client's **first consumer**, and it fails immediately. So P1-6's timezone backfill never executes, and the pre-existing-account problem P1-6 was filed to fix is still fully live. The server-side path is unaffected (Node has a real `process.env`), which is why every server-rendered date is correct and nothing else looked wrong.
**Guardrail:** Read each variable by its literal name (`process.env.NEXT_PUBLIC_SUPABASE_URL`) so the bundler can inline it, keeping the throw-if-missing behavior. **General rule: `NEXT_PUBLIC_*` must be accessed as a static literal property; any indirection — a helper taking the name as a parameter, a loop, a computed key — silently yields `undefined` in the browser while continuing to work on the server, so it fails only in the half of the app nobody tested.** Worth a test that imports the browser client in a jsdom/browser environment, since this class of bug passes every Node-environment test.

---

## Slice 1 — final review verdict: GREEN (2026-08-19)

Browser re-verification done against a real local Supabase stack, signed in as a real user. All
three findings the implementation session could not itself confirm are verified working — not by
reading the diff, but by reproducing the original failure conditions and watching them not happen.

- **P1-9 — VERIFIED FIXED.** `/dashboard` now loads with **0 console errors** (previously threw
  `Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL` on every load). The static
  literal property access is the right fix, and the comment explaining *why the duplication between
  the two functions is deliberate* is worth keeping — a future tidy-up that "DRYs" those two
  functions back into a name-parameterized helper would silently reintroduce this exact bug in the
  browser while every server-side test kept passing.
- **P1-6 — VERIFIED FIXED, by testing the mechanism rather than the code path.** Deleted the
  `timezone` key from the test user's `raw_user_meta_data` (leaving it `(NONE)`, i.e. exactly the
  state a pre-ADR-006 account is in), loaded `/dashboard`, and confirmed it came back as
  `Asia/Calcutta`. So the backfill genuinely executes now, which it never did before — this is the
  first time P1-6 has actually been true rather than merely implemented.
- **P1-8 — VERIFIED FIXED.** Refilled the exact failing case (title, a full paragraph of
  description, category, deliberately invalid `targetDate`) and submitted. The error displays *and*
  **all seven fields retain their values**, `description` included — checked via `FormData` as well
  as DOM values, after an initial false alarm on my side where a serialization quirk made
  `description` look absent. Correcting the `targetDate` and resubmitting then created the quest
  successfully (row confirmed in Postgres with `description` preserved, `start_date` 2026-08-19,
  `domain` quest), so making the fields controlled did not break the submit path.
- **P1-7** is documentation-only and accepted as a known tradeoff; the ADR-006 addendum states the
  auto-follow decision and its day-skip consequence explicitly, which is what the finding asked for.

Full suite state at verdict time: **93/93 unit tests across 9 files**, **8/8 RLS integration tests**
(run independently against local Postgres, no longer relying on CI), `eslint` clean, `tsc` clean,
working tree clean at `e73ee5f`.

Remaining open findings — **none blocking**, both deliberate deferrals with recorded trigger
conditions: **P1-4** (no per-user goal cap; revisit with SC3's work in Slice 3) and **P1-5**
(login/signup placeholder-as-label, Phase 0 code, correctly not fixed as a side effect of this
slice).

**Slice 1 is CLEAR to proceed to Slice 2.**

---

## Not flagged

**Round 2 (P1-1/P1-2/P1-3 fixes) — verified:**
- **ADR-006 is a sound decision, properly made.** Taken to the project owner as a product question rather than decided in code, three options weighed with the rejections reasoned (not just listed), and written before implementing. `todayInTimezone` is correct: `en-CA` genuinely yields `YYYY-MM-DD`, and the `try/catch` fallback handles both a missing timezone and a corrupted one (`Intl.DateTimeFormat` throws `RangeError` on an unrecognized IANA id) without throwing. Keeping it out of `rank-engine/date-utils.ts` is the right seam — that file's UTC anchoring is about arithmetic determinism and is unrelated to whose midnight counts.
- **`toUserError` is correct** and applied at `createQuest`'s only DB-error path; the real error still reaches the server log, tagged with the action name.
- **Labels:** all three quest-form fields now have `<label htmlFor>` matching the existing pattern.
- **The jsx-a11y investigation was right, and my original suggestion was wrong.** Re-tested both rules directly rather than accepting either account: with the TypeScript parser, **`jsx-a11y/label-has-associated-control` is clean on all four form files** — because it only validates that a `<label>` *has* a control, so it structurally cannot catch an input with no label at all, which is the actual P1-3/P1-5 defect. The rule that does catch it, `control-has-associated-label`, flags login (2) and signup (3) correctly but also fires on **8** quest-form elements including the already-correctly-labelled `startDate`/`targetDate`, exactly as reported. So neither rule makes this mechanical without noise, the revert was correct, and review discipline is the right call. Recorded because I suggested the rule that turned out not to fit — the correction matters more than the original suggestion.
- **Browser, reachable pages:** `/welcome`, `/rules`, `/login`, `/signup` all render with **0 console errors and 0 warnings**; auth-gated routes (`/quests/new`, `/setup`, `/dashboard`) all `307` to `/login`.
- **P1-5 is milder than "unlabelled" — measured, not assumed.** Chrome's accessibility tree reports `textbox "Email"` / `textbox "Password"` on `/login`, i.e. the accessible *name* is computed from `placeholder` per the ACCNAME fallback, so a screen reader does announce something. The real defects remain (the name vanishes visually once the field has content, and placeholder-as-label is a known anti-pattern), but it is not the total failure "no label" implies. Worth knowing when prioritizing it.

**Slice 1 — verified, so it isn't re-checked next round:**
- **`user_id` comes from the session, never client input** — confirmed at `actions.ts:49-50`: `user.id` from `supabase.auth.getUser()`, and `formData` is never consulted for it. The inline comment correctly notes RLS's `WITH CHECK` would reject a mismatch anyway but shouldn't be the only thing standing there — that's the right posture, defence in depth rather than relying on the database alone.
- **Zod ↔ DB constraint alignment** — checked directly rather than taken on trust: `domainSchema`/`frequencySchema` enums match the `goals` table's `check (domain in ...)` / `check (frequency in ...)` exactly. Length caps (`title` 200, `category` 100, `description` 2000) exist only in Zod against `text` columns, i.e. the schema is stricter than the DB, which is the safe direction and consistent with **S3**'s guardrail.
- **`createGoalSchema` is genuinely test-covered** — `goal.test.ts` from D7, unchanged this slice, including the `targetDate >= startDate` refinement this form can trigger.
- **Auth guard works in a browser, not just in the code** — `curl` against a running dev server returns `307` to `/login` for an unauthenticated `GET /quests/new`.
- **`domain` is hardcoded server-side**, not a form field, so the Quests route can't be repurposed to write another domain by crafting a request.
- **FormData edge handling is correct** — blank optional fields (`""`) normalize to `null` rather than being stored as empty strings, and the unchecked-checkbox case (absent from FormData entirely) is handled explicitly.

**Browser verification of the authenticated form UI — NOT done, and not something I can do unilaterally.** The Playwright lock that blocked the implementation session has been released (it was a stale session on this side), so that obstacle is gone. But reaching the form requires an authenticated session, and both routes there have a problem: Docker is unavailable on this machine, so there's no local Supabase to sign into, and the only other option is creating a test account in the **real linked production project** — which is exactly the kind of external side effect the D8 guard exists to prevent for the RLS suite, and not something to do without the project owner's say-so. So the specific items requested — checkbox/select/date-input behavior and error display on invalid submission — remain unverified by either session. Flagged for the owner to choose: enable Docker for a local stack, or authorize a disposable test account.
