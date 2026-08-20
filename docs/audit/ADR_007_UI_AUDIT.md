# ADR-007 UI/UX Workstream — Audit Log

Review-only log for the UI/UX redesign workstream (ADR-007). Same conventions as
`PHASE_0_AUDIT.md` — see its **"Session split: who writes what"** and **"Concurrency: when to
touch shared state, not just who"** sections, which this file inherits by reference. The auditer
session files findings and verdicts here; the implementation session fixes and flips Status lines.

Cadence matches Phase 1's: the implementation session signals each build phase (deps/tokens →
primitive swap → skin pass → the two animated components → nav wiring → QA) as it lands, and the
auditer reviews the **committed** state of that phase before the next one starts.

---

## Baseline recorded at ADR-007 time (`fcd9fe9`)

Numbers to diff against, captured before any UI work landed:

- **105/105 unit tests across 9 files** — confirmed by running the suite, not read off the ADR.
- **55 `dark:` utility occurrences across 9 `.tsx` files** (see U1).
- CSP: `script-src 'self' 'unsafe-inline'`, `style-src 'self' 'unsafe-inline'` (see U2).
- Zero sign-out references anywhere in `src/` (see U3).
- `src/lib/` contains 28 files, none of them UI (see U4).

## Review of the ADR-007 commit itself — no objections

`fcd9fe9` is a clean piece of process work and I want to say so explicitly, since most of what
follows is findings:

- The scope reversal is **recorded rather than enacted quietly** — CLAUDE.md's two affected bullets
  are corrected in the same commit as the ADR that supersedes them, which is the behavior CLAUDE.md
  asks for and the failure mode (docs drifting out of sync with decisions) it exists to prevent.
- The **presentation/logic split is drawn in the right place** and stated twice (ADR + CLAUDE.md),
  including the specific reasons the prototype's logic stays unusable — hardcoded rank formula, no
  grace/pause, per-domain progress functions. That's the distinction that keeps this workstream
  from undoing Phase 1.
- The **animation cuts are the most valuable part of the ADR.** Writing down what was *rejected*
  and why ("the dashboard is fully server-rendered with real data already resolved before first
  paint, so animating it becoming true on every visit fabricates a transition that never happened")
  is the reasoning that stops the scope quietly re-expanding three phases from now.
- **`Status: Proposed`** matches ADR-001/002/003/006 — checked all four rather than assuming it was
  an oversight. Consistent, so not a finding.
- The `docs/reference/**` exclusion from `tsc`/`eslint` is correct and correctly justified. Nothing
  imports the prototype, so the exclusion cannot mask a real type error.

---

## U1 — `dark:` utilities become OS-conditional under a "dark-only" theme

**Severity:** High · **Status:** FIXED (implementation session, mechanism-level; full
browser-in-both-colour-schemes confirmation still the auditer's own to do, per "How I'll verify"
below) — `shadcn init`'s scaffold already redefines the variant: `globals.css` carries
`@custom-variant dark (&:is(.dark *));` (class-scoped, not `prefers-color-scheme`), and
`layout.tsx` now sets `class="dark"` on `<html>` unconditionally (ADR-007's dark-only decision,
not a separate fix). Verified two ways since the shared browser was in active use by this audit
session at the time: SSR output confirms `<html lang="en" class="dark ...">` on a real page load,
and the compiled production CSS chunk confirms `.dark`-scoped selectors are being generated (not
`@media (prefers-color-scheme:...)`). All 55 existing `dark:` occurrences activate unconditionally
as a structural consequence — none were stripped, since the variant redefinition makes that
unnecessary and leaves the prefixes semantically honest (they still mean "the dark-theme value",
just no longer gated on OS preference). **Raised:** 2026-08-19 (pre-flight, before the skin pass)

ADR-007 drops the light/dark split for a dark-only theme. `src/app/globals.css` currently keys
`--background`/`--foreground` off `@media (prefers-color-scheme: dark)`, and **55 `dark:` utility
occurrences across 9 files** depend on Tailwind's default `dark:` variant, which also resolves
against `prefers-color-scheme`.

Making the *tokens* unconditional does not make the *utilities* unconditional. If the skin pass sets
a dark background but leaves the `dark:` prefixes in place, then for a visitor whose OS is in light
mode every `dark:` utility silently stops applying:

- `dark:border-zinc-700` → falls back to `border-zinc-300`, light-grey borders on a dark panel.
- `dark:bg-transparent` on the quest-form inputs → inputs keep their default light background.

**Why this is easy to miss:** almost everyone building or testing this app has their OS in dark
mode, where the bug is invisible. It only appears for a light-OS user, and nothing in
`tsc`/`eslint`/`vitest`/`next build` can catch it.

**Fix direction (implementation session's call):** either strip the `dark:` prefixes during the skin
pass since they no longer mean anything, or redefine the variant so it is unconditionally true —
Tailwind v4's `@custom-variant dark (&:where(:root, :root *))`, or the `.dark`-class strategy with
the class set on `<html>`. Stripping is cleaner; leaving 55 dead conditionals in a dark-only app is
the kind of thing that reads as intentional to the next person.

**How I'll verify:** force `prefers-color-scheme: light` in the browser and walk the pages. This is
a specific check I will run at the skin pass, not a general "looks fine."

---

## U2 — Motion's inline `style` attributes constrain how S2 (CSP) can be fixed

**Severity:** Medium · **Status:** OPEN · **Raised:** 2026-08-19 (pre-flight)

Not a defect in ADR-007 — a constraint ADR-007 places on an already-open Phase 0 finding, recorded
now so it isn't discovered as a surprise breakage later.

**S2** (`PHASE_0_AUDIT.md`) is open against the CSP's `'unsafe-inline'`, and the intended fix is a
nonce migration. Motion for React animates by writing **inline `style=` attributes** onto DOM nodes
every frame. CSP nonces apply to `<style>` *elements* and `<script>` — they do **not** apply to
`style=` attributes, which are governed solely by `'unsafe-inline'` (or per-attribute hashes, which
are unusable for values that change every frame).

So after ADR-007 lands, S2's achievable end state is: **nonce `script-src`, and keep
`style-src 'unsafe-inline'` with the reason stated in `next.config.ts`.** Removing `'unsafe-inline'`
from `style-src` would break both animated components.

This does not weaken S2 — `script-src` is where the XSS risk actually lives, and that half stays
fully fixable. It only means S2 should not be scoped or closed as "remove `'unsafe-inline'`
everywhere."

---

## U3 — the app has no sign-out affordance, and the nav shell is the moment to decide

**Severity:** Medium · **Status:** DECIDED (owner, 2026-08-19) — sign-out gets built into phase 6's
nav wiring, not tracked as a separate slice. Not yet implemented; this is the decision record, the
work lands with phase 6. **Raised:** 2026-08-19

`grep` across `src/` returns **zero** references to `signOut`, "sign out", "log out", or "logout".
There is no way for a signed-in user to end their session from the UI — the session simply persists.

Pre-existing, not caused by ADR-007, and genuinely outside its stated scope. It is raised **now**
because of timing: ADR-007 builds the nav shell this workstream, and the nav shell is where a
sign-out control belongs. Building the nav without deciding this means either bolting it on
afterwards or opening beta access (CLAUDE.md puts that at the end of Phase 2) with testers who
cannot log out on a shared machine.

**Owner's call**, not the implementation session's: fold a sign-out control into the nav wiring
phase, or track it as its own slice. Either is defensible; leaving it undecided while the nav gets
built is the option that costs rework.

---

## U4 — the "no logic files changed" guardrail needs its `src/lib/utils.ts` carve-out named now

**Severity:** Low (process) · **Status:** FIXED — ADR-007's Test Surface section now reads "no
diff anywhere under `src/lib/**` for the duration of this work, except `src/lib/utils.ts`
(shadcn's CLI-generated `cn()` helper) and this file's own `src/components/ui/motion.ts` presets
module" — the suggested wording, plus naming the plan's own motion-tokens module as a second
legitimate exception up front rather than waiting for it to trip the rule later. **Raised:**
2026-08-19 (pre-flight)

ADR-007's Test Surface section sets an excellent mechanical guardrail: *"no file under
`src/lib/rank-engine/`, `src/lib/rank-data.ts`, or any `actions.ts` should change as part of this
work; any diff there means scope crept beyond this ADR."* Agreed, and I will enforce it literally
with `git diff --stat` at every phase signal.

Two gaps in the guardrail as written:

1. **It doesn't cover the rest of `src/lib/**`.** `today.ts`, `schemas/`, `supabase/`,
   `rate-limit.ts`, `errors.ts`, `request-ip.ts` are equally out of scope for presentation work, and
   a diff in any of them would be exactly the same signal.
2. **shadcn's CLI writes `src/lib/utils.ts`** (the `cn()` helper). Under the tightened rule that is
   a legitimate new file, but if it isn't named in advance it either trips the guardrail or gets
   waived ad hoc — and a guardrail that gets waived once stops being one.

**Suggested wording:** *no diff anywhere under `src/lib/**` except the new `src/lib/utils.ts`.*
Mechanically checkable, no judgment call at review time.

---

## U5 — Geist is loaded on every page and never applied to body text

**Severity:** Low · **Status:** FIXED — resolved as a side effect of fully rewriting
`globals.css` from shadcn's scaffold rather than hand-editing the old file; the old
`body { font-family: Arial, Helvetica, sans-serif; }` override doesn't exist in the new file at
all (shadcn's own `@layer base` block only sets `html { @apply font-sans; }`, nothing on `body`).
Verified in the compiled production CSS: `html{font-family:var(--font-rajdhani)}`, and the only
other `Arial` occurrences are `next/font`'s own automatic size-matched local-fallback `@font-face`
declarations (`Rajdhani Fallback`/`Chakra Petch Fallback`) plus the generic system-font fallback
chain — not an override. **Raised:** 2026-08-19 (pre-existing)

`src/app/layout.tsx` loads **two** `next/font/google` families (Geist Sans, Geist Mono) and wires
them to CSS variables, and `globals.css` maps them through `@theme inline` to `--font-sans`. But
the same file then ends with:

```css
body { font-family: Arial, Helvetica, sans-serif; }
```

`<body>` carries no `font-sans` class, so that rule wins. **The app pays for two webfonts and
renders body text in Arial.** Pre-existing (it's untouched Create-Next-App scaffolding), and
harmless today beyond the wasted download.

It's raised here because ADR-007 replaces the typography with Chakra Petch / Rajdhani. If that
`body` rule survives the token phase, the new fonts get loaded and ignored in exactly the same way —
and this time it's a visible failure to match the client's reference, not just wasted bytes. The
token phase is the natural moment to delete the rule.

---

## U6 — review shadcn's `globals.css` rewrite rather than accepting it wholesale

**Severity:** Low · **Status:** FIXED — read the CLI's diff rather than accepting it wholesale,
per the finding's own ask. It did drop the old Geist-specific mapping (expected, correctly), and
the `@theme inline` block was rewritten by hand to wire `--font-sans`/`--font-mono`/`--font-heading`
to the new `--font-rajdhani`/`--font-chakra-petch` variables `layout.tsx` sets, rather than left on
whatever the CLI defaulted to. Confirmed wired correctly in the compiled CSS (see U5's verification
above — same evidence covers both). **Raised:** 2026-08-19 (pre-flight)

`shadcn init` rewrites `globals.css` with its own token block. The current file carries the
`@theme inline` mapping that wires `--font-geist-*` (set in `layout.tsx`) into Tailwind's font
scale. If the CLI's output drops that mapping while `layout.tsx` keeps setting the variables, the
wiring breaks silently — no error, just fonts that don't apply (the U5 failure mode, arrived at by a
different route).

Not an argument against the CLI, which ADR-007 justifies well. Just: read the diff it produces to
`globals.css` and `layout.tsx` before committing, rather than treating generated files as reviewed.
`components.json` appearing untracked in the working tree suggests this phase is already in
progress, so this one is time-sensitive.

---

## Standing checks for every phase of this workstream

Recorded once so each phase verdict can reference them instead of restating:

1. **`git diff --stat` against `fcd9fe9`** — no diff under `src/lib/**` except `src/lib/utils.ts`,
   and none in any `actions.ts` (U4).
2. **105/105 unit tests** still 105/105. A dropped test is as much a regression as a failing one.
3. **RLS integration suite** run against local Postgres, not taken from CI.
4. **Browser pass in both OS colour schemes**, not just dark (U1).
5. **Console clean** — zero errors and zero warnings on every reachable route. This is what caught
   P1-9, which had been marked FIXED while never actually executing.
6. **The Phase 1 Slice 4 flow re-walked end to end** — signup → setup → dashboard → create a quest →
   complete it → streak and score update → non-daily goal in the overall list → `/quests` redirects.
   Presentation-layer work should change how every one of those looks and nothing about what any of
   them does.

---

## Phase 2 (dependencies + design tokens) — verdict: GREEN, `61909a2`

Reviewed the committed state. `globals.css` and `layout.tsx` are unmodified in the working tree, so
everything below measures commit `61909a2` exactly, not work in progress.

**U1 — VERIFIED FIXED in the browser, both OS colour schemes.** This is the check the
implementation session explicitly left to the auditer, and it passes. Loaded the app under
Playwright with `emulateMedia({ colorScheme })` forced each way and read computed styles:

| | `prefers-color-scheme: light` | `prefers-color-scheme: dark` |
|---|---|---|
| `matchMedia('(prefers-color-scheme: dark)')` | `false` | `true` |
| `<html>` class | `dark …` | `dark …` |
| computed `body` background | `#05070e` | `#05070e` |
| computed `body` font | Rajdhani | Rajdhani |

The OS preference genuinely no longer participates. `@custom-variant dark (&:is(.dark *))` plus an
unconditional `class="dark"` is the correct mechanism, and the choice to redefine the variant rather
than strip 55 prefixes is the better of the two options I offered — the prefixes stay semantically
honest and the skin pass gets to replace them on its own schedule.

One structural note for whoever touches this next, not a defect: `&:is(.dark *)` matches
*descendants* of `.dark`, so a `dark:` utility placed on the `<html>` element itself would silently
not apply. Nothing does that today (checked `layout.tsx`). The related trap is that `<html
class="dark">` is now load-bearing for all 55 utilities while the tokens are duplicated across
`:root, .dark` and would survive without it — so removing the class would look safe and would
quietly reinstate exactly the U1 failure mode.

**U5/U6 — VERIFIED FIXED.** Computed `body` font-family is `Rajdhani, "Rajdhani Fallback"`. The
Arial override is gone and the fonts the app pays to load are the fonts it renders.

**Standing checks 1, 2:** `git diff --stat fcd9fe9..61909a2` touches `src/lib/utils.ts` only under
`src/lib/**` (6 lines, `cn()` exactly as expected) and no `actions.ts`. **105/105 unit tests pass**,
`tsc --noEmit` clean.

**Two things I checked because they looked wrong and turned out to be fine** — recorded so nobody
re-investigates them:

- `@import "shadcn/tailwind.css"` has no matching file at `node_modules/shadcn/tailwind.css`. It
  resolves through the package's `exports` map (`"./tailwind.css": "./dist/tailwind.css"`), which
  exists. Not broken.
- That file could have collided with the hand-written token block. It doesn't — it declares only
  `data-*` attribute variants, no `:root`, no `.dark`, no `--radius`, no token of any kind.

**Worth crediting:** `--radius-sm: calc(var(--radius) * 0.6)` replaces shadcn's default subtractive
formula. At `--radius: 2px` the stock `calc(var(--radius) - 4px)` would compute to `-2px` and be
dropped as invalid. Switching to multiplicative is a real catch, not a cosmetic edit.

---

## U7 — the tightened guardrail's second exception names a path the rule doesn't cover

**Severity:** Low (process) · **Status:** FIXED — moved the presets module to `src/lib/motion.ts`
(not `src/components/ui/motion.ts`, which was hypothetical at finding time and never committed
there) and reworded ADR-007's Test Surface exception to name that path directly, so the `src/lib/**`
exception is coherent rather than a no-op carve-out. **Raised:** 2026-08-19

ADR-007's Test Surface now reads: *"no diff anywhere under `src/lib/**` … **except**
`src/lib/utils.ts` … and this file's own `src/components/ui/motion.ts` presets module."*

`src/components/ui/motion.ts` is not under `src/lib/**`, so as written it is an exception to a rule
that never applied to it — a no-op that reads like a carve-out. Harmless to the guardrail's strength
(nothing is wrongly permitted), but it makes the sentence self-contradictory, which is the property
U4 was trying to remove. Either drop it, or state it separately as "the presets module lives at X."

Two follow-ons worth deciding while the wording is being touched:

- **The module doesn't exist yet.** `src/components/ui/` currently holds eight CLI-generated
  components and no `motion.ts`, so the exception is presently hypothetical.
- **`src/components/ui/` is shadcn's generated-output directory.** Putting a hand-authored module
  in it mixes authored and generated code in the one directory where `shadcn add` writes files.
  `src/lib/motion.ts` — which is what the peer message described — would be the cleaner home, and
  would also make the `src/lib/**` exception coherent.

---

## U8 — `--font-mono` points at a proportional typeface

**Severity:** Low · **Status:** FIXED — removed the `--font-mono: var(--font-chakra-petch)` line
from `globals.css`'s `@theme inline` block entirely, so `font-mono` falls back to Tailwind/shadcn's
own default monospace stack rather than a proportional face. `--font-heading` (already
`--font-chakra-petch`, already used correctly by `card.tsx`) remains the intended slot for the
display face. **Raised:** 2026-08-19

`globals.css` maps `--font-mono: var(--font-chakra-petch)`. Chakra Petch is a proportional
display sans, not a monospace family, so Tailwind's `font-mono` utility now yields a font with no
fixed advance width.

Nothing in `src/` uses `font-mono` today, so this is a trap rather than a live bug — and the file
already defines `--font-heading: var(--font-chakra-petch)`, which `card.tsx` uses correctly. That is
the honest slot for a display face.

The cost lands later: the first person who reaches for `font-mono` will be doing it for the reason
people reach for mono — aligning digits in a streak counter, a rank table, a score column — and will
get proportional figures that don't line up, from a token that told them they were getting
monospace. Suggest leaving `--font-mono` at Tailwind's default stack and using `font-heading` where
Chakra Petch is wanted.

---

## U9 — dev server 403s its own chunks when reached over `127.0.0.1`

**Severity:** Low (dev-only) · **Status:** FIXED — added `allowedDevOrigins: ["127.0.0.1"]` to
`next.config.ts`, with a comment explaining why `127.0.0.1` specifically (this project's
`.env.local` points Supabase at `http://127.0.0.1:54321`, so it's the host people here naturally
type). No production effect, per the finding's own note. **Raised:** 2026-08-19

`next.config.ts` sets no `allowedDevOrigins`. Next 16's dev server rejects `/_next/*` requests
carrying an `Origin` header it doesn't recognise, and `127.0.0.1` is not covered by the default
allowlist while `localhost` is. Browsing the dev app at `http://127.0.0.1:<port>` therefore fails to
load three JS chunks per route with `403 Forbidden`, plus a failing HMR WebSocket handshake.

Isolated to the single header rather than guessed — same URL, same server, varying one header:

| request | status |
|---|---|
| bare `curl` | 200 |
| `+ Referer` | 200 |
| `+ Sec-Fetch-Dest: script` | 200 |
| `+ Sec-Fetch-Site: same-origin` | 200 |
| `+ Origin: http://127.0.0.1:<port>` | **403** |

A full four-route browser sweep over `localhost` was clean — zero failed requests, zero console
errors — while the identical sweep over `127.0.0.1` produced 403s on every route.

Production is unaffected (`next start` and Vercel don't apply this check). It matters here only
because this project's own `.env.local` points Supabase at `http://127.0.0.1:54321`, so
`127.0.0.1` is the host people working on this codebase naturally type — and the failure mode is
a half-hydrated page with a console full of 403s, which reads like an application bug. One line
(`allowedDevOrigins: ["127.0.0.1"]`) removes the trap.

**This one cost me time and nearly became a filed defect**, which is the argument for fixing it:
the first sweep looked like a genuine regression in committed code.

---

## Deferred to the Phase 3 (primitive swap) review — not findings against `61909a2`

Measured while probing, but the pages carrying these classes are being rewritten right now, so
they are checks to apply at Phase 3 rather than defects in Phase 2:

- **Contrast baseline for the skin pass.** Against the new `#05070e` background, measured in-browser
  via canvas sRGB conversion (`getComputedStyle` returns `lab()` for these tokens, which will
  silently produce nonsense if parsed as RGB — it did on my first attempt): `--foreground`
  **16.32:1**, `--muted-foreground` **5.11:1**. Both clear WCAG AA. The 20 `text-zinc-500`
  occurrences the swap is replacing sat at roughly **4.2:1** on this background, i.e. below AA —
  so `text-muted-foreground` is both the semantically right replacement and a measurable
  improvement. Worth confirming that is what they became.
- **Whatever replaces `dark:border-zinc-700`** should be checked against `--border`, which is
  translucent (`… / 22%`) and composites differently over `--card` than over `--background`.

**Concurrency note:** the page-level numbers above were read while the primitive swap was
uncommitted in the working tree (all 9 pages modified, `src/components/ui/` untracked). They
describe work in progress and should not be read as a review of it — that happens when it's
committed. The Phase 2 verdict itself is unaffected: `globals.css` and `layout.tsx` were clean in
the tree throughout.

---

## Phase 3 (primitive component swap) — verdict: **RED — one blocking regression**, `9b699d5`

Everything mechanical passes: the `src/lib/**` guardrail holds exactly (only `motion.ts` and
`utils.ts`, no `actions.ts`), **105/105 tests**, `tsc` clean, `eslint` clean, and a full authenticated
walk produced **0 console errors and 0 warnings** on every route. The engine is provably untouched —
toggling a checklist item moved the dashboard from `0-day streak · Overall score 1` to `1-day streak
· Overall score 22`, matching Phase 1 Slice 4's original numbers exactly. `/quests` still redirects.

One finding blocks the phase.

---

## U10 — a rejected submission silently re-checks "Track this daily", reversing the user's choice

**Severity:** High · **Status:** FIXED — two attempts, both verified in a real browser against real
Postgres before being trusted, not assumed from reading the diff.

**First attempt (rejected by verification, not shipped):** the suggested fix direction ("drop
`name`") turned out not to work. Read `@radix-ui/react-checkbox`'s actual source before implementing
anything: the `reset` listener that causes this bug lives in `CheckboxTrigger`, keyed only on
`control?.form` (the trigger button's native DOM `.form` property, resolved purely by being nested
inside a `<form>`) — `name`/the bubble input are never consulted by that listener at all. Swapped to
a plain native `<input type="checkbox">` instead (same reasoning as the native `<select>` — a
*native* controlled input's `onChange` is never called by a reset event, only the DOM property
flickers and the next render reasserts it). Reproduced U10 against this version anyway: **still
failed.** React 19's own form-reset restores a controlled checkbox's `checked` prop to its value *at
mount*, which is a different mechanism than Radix's explicit listener but the identical symptom —
confirmed the flip is a real DOM property change (`document.querySelector(...).checked === true`),
not a stale accessibility-tree snapshot, before concluding the first fix hadn't worked.

**Second attempt (what shipped):** the visible checkbox stopped being the thing that gets submitted.
It still updates `dailyTracking` state (cosmetic — may itself flicker back to checked after a reset,
same as before, but nothing downstream reads it) and a `dailyTrackingRef` that only a genuine
`onChange` call ever writes to, so nothing else can touch it. A separate hidden `<input
type="hidden" name="dailyTracking">` is the actual submitted field, written from the ref
imperatively in the form's `onSubmit` — the same pattern `setup-form.tsx` already uses for
`timezone`, applied here for the identical reason (a value that must survive to submission without
passing through the reset-vulnerable controlled-state path).

**Re-ran the exact repro against the fix:** unchecked → invalid `targetDate` → rejected (error shown
correctly) → checked `document.querySelector('input[name="dailyTracking"]').value` at that point:
`""` (correct, despite the visible checkbox still showing checked) → fixed only the date → resubmit
→ confirmed in Postgres: `daily_tracking = f`. Also re-verified the happy path (box left checked,
default) still creates `daily_tracking = t`. 0 console errors/warnings throughout. Left-over bad row
from the first (failed) attempt deleted from the local stack. **Raised:** 2026-08-19 (regression,
introduced by `9b699d5`)

Swapping the native `<input type="checkbox">` for Radix's `Checkbox` reintroduced P1-8's failure mode
on the one field that was swapped — and in a worse form. P1-8 *lost* what the user typed, which is
visible and recoverable. This *substitutes the opposite value* and gives the user no way to notice.

**Reproduction, end to end:**

1. On `/quests/new`, fill the form and **uncheck** "Track this daily".
2. Enter a `targetDate` before the `startDate` (or trigger any other server-side rejection).
3. Submit. The error `targetDate must be on or after startDate` displays correctly.
4. Fix only the date — the one thing the error named — and submit again.
5. **The quest is created with `daily_tracking = true`.**

Confirmed in Postgres, not inferred from the UI:

```
             title              | daily_tracking | frequency
--------------------------------+----------------+-----------
 P3 NON-DAILY consequence probe | t              | daily
```

The dashboard then lists that goal under **Today's Tasks**, and it contributes to rank and streak —
a goal the user explicitly opted out of daily tracking is now driving their rank number.

**Measured state, before and after the rejected submit** (read from `FormData`, not from the DOM's
appearance):

| | `data-state` | `FormData.get("dailyTracking")` |
|---|---|---|
| after the user unchecks | `unchecked` | `null` |
| after the rejected submit | **`checked`** | **`"on"`** |

Every other field survives correctly — `title`, `description`, `category`, `frequency`, `startDate`
and `targetDate` all retain their values, so P1-8's original fix is intact. The checkbox is the only
field that reverts.

**Mechanism**, isolated with a bare `reset` event and no submit at all — dispatching
`new Event('reset')` on the form flips `unchecked` → `checked` on its own:

Radix's Checkbox registers a `reset` listener on its parent form and restores `defaultChecked`,
captured at mount (`true` here). Because the component is *controlled*, that restore calls
`onCheckedChange`, which runs `setDailyTracking(...)` and overwrites the React state. So the
controlled pattern that protects the other fields is precisely what propagates the reset into
application state for this one. React 19 resets the form on every completed action, success or
failure — the same behavior P1-8 documented.

The native `<select>` survives the same reset because a controlled `<select>` has no equivalent
listener: React re-asserts `value` on re-render and nothing fires `onChange`. That asymmetry is why
this was invisible to a walk that only exercised the happy path.

**Fix direction** (implementation session's call): keep the Radix `Checkbox` presentational — drop
its `name` so no bubble input is rendered — and submit the value through a controlled hidden input
the reset can't reach. That preserves `formData.get("dailyTracking") === "on"` exactly as
`createQuest` expects and needs no change to `actions.ts`, which the ADR-007 guardrail puts out of
scope anyway. Re-asserting state from a `reset` handler also works but leaves a race between two
listeners on the same event.

**Scope — checked, not assumed.** Three files use `Checkbox`:
- `new-quest-form.tsx` — **affected** (inside a `<form action>` with a `name`).
- `today-checklist.tsx` — **not affected**; no form ancestor, no `name`, invoked imperatively.
- `rules/page.tsx` — **not affected**; a plain `<label>` + `<Link>`, no form.

`setup-form.tsx` has a form but no checkbox.

**Verified working in the same pass, so the swap is sound apart from this:** the checkbox's
accessible name resolves correctly (`getByRole('checkbox', { name: 'Track this daily' })` matches),
Radix's hidden bubble input is genuinely invisible (`opacity: 0`, `position: absolute`,
`pointer-events: none`), the checked state renders a real filled style plus the tick, and — outside
the reset path — `FormData` carries `"on"` when checked and omits the key entirely when unchecked,
matching the native contract `createQuest` was written against.

---

## U11 — `src/components/ui/select.tsx` is committed but never imported

**Severity:** Low · **Status:** FIXED — deleted. The U10 fix doesn't need it either; nothing in the
app uses Radix's Select. **Raised:** 2026-08-19

The quest form's frequency field deliberately keeps a native `<select>` (correctly — and the inline
comment explaining why is exactly the right way to record that decision). The CLI-generated
`select.tsx` was committed anyway: 192 lines that nothing imports. Nothing is tree-shaken *into* the
bundle, so there's no runtime cost — it's a maintenance signal only. Either delete it, or add a
one-line header saying it's staged for a later phase, so the next reader doesn't take its presence
as evidence the native select was an oversight.

---

## U12 — the progress bar has no accessible name

**Severity:** Low · **Status:** FIXED — `Progress` now takes a required `label` prop (`aria-label`),
not optional, so every future usage has to supply one rather than silently omitting it. Dashboard's
usage passes the same string already rendered visually ("`{pct}% toward {rank} rank`"), so the
accessible name and the visible text stay in sync by construction. **Raised:** 2026-08-19

`Progress` is a good component — a plain Server Component with a correct `role="progressbar"` and
the full `aria-valuenow`/`valuemin`/`valuemax` triad, and the reasoning for not using Radix's is
sound. It has no `aria-label` or `aria-labelledby`, so a screen reader announces "progress bar, 2"
with no indication of what is 2% complete. The adjacent text ("2% toward D rank") supplies that
visually but is not programmatically associated. An `aria-label` on the element, or
`aria-labelledby` pointing at that paragraph, closes it.

---

## Also noted, not new

**P1-5 is unchanged.** `/signup`'s `name`, `email` and `password` inputs still carry no `id` and no
`<Label htmlFor>`, so their accessible names still come from `placeholder` via the ACCNAME fallback.
The swap moved them to shadcn's `Input` without adding `Label`, and `Label` is now already imported
in the codebase — so the cost of closing P1-5 has dropped. Still not a regression, and still
correctly out of scope for a no-functional-change pass.

**Recorded so nobody removes it as boilerplate:** `@import "shadcn/tailwind.css"` in `globals.css`
is load-bearing. Radix emits `data-state="checked"`, while the primitives style on `data-checked:` —
those only connect because that file defines `@custom-variant data-checked` matching **both**
`[data-state="checked"]` and `[data-checked]`. Drop the import and every checked/unchecked style in
the primitives stops applying while the components keep working functionally, which is a hard
failure to trace back to a deleted stylesheet import.

**Test data:** this pass left one user, one goal (`P3 NON-DAILY consequence probe`, the U10
evidence) and one entry in the local stack. Worth keeping until U10 is fixed, then clearing.

---

## U10 re-verification (`02e67e2`) — **data path FIXED**, one new display-level issue

Re-ran the exact reproduction independently, on a fresh account, against real Postgres.

| scenario | `daily_tracking` in DB | correct? |
|---|---|---|
| unchecked → rejected → fix date only → resubmit | `f` | ✅ (was `t` — this was U10) |
| happy path, checkbox untouched | `t` | ✅ |
| default-checked → rejected → fix date only → resubmit | `t` | ✅ |

**U10 is fixed.** 105/105 tests, `tsc` clean, `eslint` clean, guardrail untouched (no diff under
`src/lib/**` or any `actions.ts`), 0 console errors and 0 warnings throughout.

**U12 verified fixed** — the progress bar's `aria-label` reads `2% toward D rank`, matching the
visible text exactly. Making `label` a required prop rather than optional is the right call: it
makes the omission a compile error instead of a silent gap. **U11 verified** — `select.tsx` deleted.

**Credit where it's due:** the implementation session reproduced U10 against its *own first fix*
before reporting it, and found that a plain native controlled checkbox is reset by React 19 the same
way — a second, independent mechanism with identical symptoms. Correcting my suggested fix direction
("drop `name`") by reading Radix's source rather than taking it on trust was right, and the reset
listener does indeed live in `CheckboxTrigger` keyed only on form nesting.

---

## U13 — after a rejected submission the checkbox displays the opposite of what it will submit

**Severity:** Medium · **Status:** FIXED — redesigned rather than patched. Dropped the separate
hidden input/second ref entirely (also closes U14 below, by construction, not by fixing its
symptom). The checkbox is now uncontrolled and IS the submitted field (`defaultChecked` + real
`name`); `onChange` only updates `dailyTrackingRef`. The form's `onReset` reasserts the checkbox's
own `checked` DOM property from that ref the moment the browser resets it — fixing the display
directly, not compensating for it elsewhere. **Raised:** 2026-08-19

The fix moved the corruption out of the data path but left it in the display. Measured immediately
after a rejected submit, having unchecked the box first:

| | value |
|---|---|
| visible checkbox `checked` | **`true`** |
| hidden input value | **`""`** (i.e. not daily) |

So the form shows "Track this daily" ticked while it will submit the opposite. The commit's own
comment acknowledges this as cosmetic. It isn't quite — it can still produce a wrong outcome, just
by a longer route:

1. User unchecks "Track this daily".
2. Submission is rejected for an unrelated reason (bad date).
3. The box visibly re-checks itself.
4. User reads that as "fine, it's daily" and accepts it, fixing only the date.
5. They get a **non-daily** quest, having last seen a ticked box.

The data now correctly honors the user's last *explicit* action, which is the right default. But the
UI asserts the opposite of it, and a user acting on what they see gets a result they didn't choose.
Same class as U10 — a silent mismatch between intent and outcome — with the direction reversed.

**Fix direction:** re-assert the visible checkbox from `dailyTrackingRef` when the reset happens —
an `onReset` on the form, or restoring state alongside the existing `onSubmit` write. The ref is
already the single source of truth; the display just needs to follow it. Worth confirming in the
browser that React's post-action reset fires a catchable `reset` event on the form (the U10
investigation showed a dispatched `reset` reproduces the behavior, which suggests it will).

---

## U14 — the hidden input's default is the opposite of the visible default

**Severity:** Low · **Status:** FIXED — moot, not patched. The U13 redesign removed the separate
hidden input entirely; there's only one field now (the checkbox itself, `defaultChecked`), so there
is no second default to disagree with it. **Raised:** 2026-08-19

`<input ref={dailyTrackingInputRef} type="hidden" name="dailyTracking" />` renders with no value, so
its value is `""` until `onSubmit` writes it. The visible checkbox defaults to **checked**, so the
two disagree at rest, and the submitted value is correct only because `onSubmit` runs first every
time.

That holds today — all three scenarios above confirm it. The concern is the failure mode if it ever
stops holding: any path that submits without `onSubmit` completing sends `""`, silently creating a
**non-daily** quest, which is both the opposite of the visible state and the value that quietly
excludes the goal from the rank engine.

**Fix direction:** give the hidden input `defaultValue="on"` so the at-rest value matches the visible
default. Then a missed `onSubmit` degrades to what the user sees rather than to its inverse. Cheap
insurance on a field whose wrong value is invisible.

---

**Local test data:** this pass added 1 user and 3 goals (`U10 RECHECK *`). My earlier `P3 NON-DAILY
consequence probe` row (the original U10 evidence) is also still present and can now be cleared.

---

## U10 re-verification (`85bf60b`) — **REGRESSED. U10 is live again.**

**Severity:** High · **Status:** OPEN · **Raised:** 2026-08-19

The U13/U14 redesign reintroduced the original U10 defect. Same reproduction, fresh account, real
Postgres:

```
        title         | daily_tracking
----------------------+----------------
 U13 verify unchecked | t              <- user had unchecked it
```

| after a rejected submit | value |
|---|---|
| visible checkbox `checked` | `true` |
| `FormData.get("dailyTracking")` | `"on"` |

Both wrong, and now agreeing with each other — so U13's symptom is gone only because the data
regressed to match the display. `02e67e2` submitted the correct value; `85bf60b` does not.

**Cause — `onReset` writes too early.** The `reset` event fires *before* the form-reset algorithm
runs, so the handler's write is immediately overwritten. Measured directly:

| observation | `checked` |
|---|---|
| inside the handler, before its write | `false` |
| inside the handler, after its write | `false` |
| immediately after `dispatchEvent` returns | **`true`** |

The handler does execute and does write — the reset algorithm simply runs afterwards and undoes it.

**Fix — defer the write out of the handler.** Both deferrals verified to hold in the browser:

| approach | `checked` after reset settles |
|---|---|
| write synchronously in the handler (current) | `true` ❌ |
| `queueMicrotask(() => { el.checked = ref.current })` | `false` ✅ |
| `setTimeout(..., 0)` | `false` ✅ |

The uncontrolled-checkbox design is sound and worth keeping — it's strictly simpler than the
hidden-input version and does remove U14 by construction. Only the write's timing is wrong. Note
that the table above was produced with a synthetic `reset` dispatch; React's post-action reset
should follow the same path, but the fix needs the full browser reproduction re-run end to end
before it's called fixed.

**Process note, not a criticism of the fix:** `02e67e2` was verified against this exact
reproduction and passed; `85bf60b` changed the mechanism and was landed without re-running it. The
reproduction is cheap and already written down — re-running it on any change to this field is the
guardrail that would have caught this before the commit.

Suite state at verdict: 105/105 tests, `tsc` clean, `eslint` clean, 0 console errors/warnings.
Green checks do not cover this path — no test exercises the rejected-submission reset.

---

## U10/U13/U14 — redesigned again, not re-timed

**Status:** awaiting auditer verification (not browser-tested by the implementation session this
round — that's the auditer's lane).

Dropped the reset-timing fix (`queueMicrotask`) per the owner's steer that a checkbox `<input>`
fighting a browser reset is the wrong shape regardless of timing. New design: no refs, no
`onReset`, no deferral. Extracted to a shared `src/components/ui/form-checkbox.tsx`, composed from
the existing `Button` (as an icon-sized `type="button"` toggle — not form-associable, so no reset
algorithm ever touches it) and `Input` (`type="hidden"`, controlled `value`, the same pattern
already proven correct for every other field in this form). State is plain `useState` in the
component, submitted through the hidden `Input`.

Also: a new `no-restricted-syntax` ESLint rule now errors on raw `<button>`/`<input>`/`<textarea>`
anywhere under `src/**` except the three files that legitimately wrap them for the first time
(`button.tsx`/`input.tsx`/`textarea.tsx`) — added after the first version of this fix hand-rolled
raw elements inside `components/ui/` itself instead of composing the existing primitives, which a
directory-level exemption let through silently. See the rulebook below.

Same repro as before applies. Ready for re-verification.

---

## Rulebook — mechanical rules from this workstream, for future code generation

Distilled from what actually went wrong across U10/U13/U14 and the primitive-enforcement gap, so
the same mistakes don't get regenerated. Each rule names the finding it came from.

1. **A form control's `checked`/`value` surviving a browser's native `reset` is not guaranteed by
   making it "controlled."** Text/date/select inputs survive reliably; a checkbox's `checked` does
   not — React 19's post-action form reset (and, separately, Radix's own reset listener) can
   restore it to its mount-time default through a path that bypasses the normal
   controlled-value reconciliation. (U10, three failed attempts before the real cause was found.)
   **Rule:** any checkbox living inside a `<form action={fn}>` must not be a form-associable
   element at all — use a `type="button"` toggle (immune to reset by construction) paired with a
   separate controlled hidden field for submission. `src/components/ui/form-checkbox.tsx` is the
   reusable version; reach for it, don't reinvent it per-form.
2. **Reproduce the original failure against a fix before calling it fixed — a suggested fix
   direction (a peer's, or your own first instinct) is a hypothesis, not a result.** Two suggested
   fixes for U10 (drop `name`; write synchronously in `onReset`) both looked right and both failed
   when actually reproduced. **Rule:** re-run the exact repro after every change to
   reset-sensitive/timing-sensitive code, not just after the first fix.
3. **A `type="hidden"` field's styling is irrelevant — it never paints — so route it through the
   shared `Input` anyway.** "It doesn't need styling" is not a reason to hand-roll it; it's a
   reason using the shared component costs nothing. (Caught twice: once in
   `form-checkbox.tsx`'s own hidden field, once in `setup-form.tsx`'s pre-existing one, which had
   grown an `eslint-disable` comment defending the raw version instead of just fixing it.)
4. **When adding a new shared component under `src/components/ui/`, compose the existing
   primitives (`Button`/`Input`/`Textarea`/…) — don't hand-roll raw elements just because the file
   lives in the primitives directory.** Only the base-wrapper files get to touch a raw element
   directly, and there are exactly three of them. Being in `components/ui/` is not itself a
   license to bypass the primitives.
5. **A lint exemption scoped to a whole directory silently permits drift; scope it to the specific
   files that need it.** The first version of the `no-restricted-syntax` rule exempted all of
   `src/components/ui/`, which is exactly what let `form-checkbox.tsx` hand-roll raw markup
   unflagged. Fixed to an explicit per-file `ignores` list — a new base primitive that legitimately
   needs raw elements will fail lint until its file is added, so the rule fails closed instead of
   silently.
6. **React 19 function components accept `ref` as a plain prop — `forwardRef` is not required.**
   Don't assume a shared primitive can't take a `ref` and fall back to a raw element because of it;
   verify first (`tsc` will confirm it type-checks).

---

## U10 / U13 / U14 — final verdict (`107b5e2`): **GREEN, all three closed**

Full reproduction re-run end to end on a fresh account against real Postgres.

| scenario | `daily_tracking` | correct? |
|---|---|---|
| unchecked → rejected → fix date only → resubmit | `f` | ✅ |
| happy path, control untouched | `t` | ✅ |

| state check | result |
|---|---|
| after the rejected submit | `aria-checked=false`, hidden `""`, FormData `""` ✅ |
| on fresh load (`defaultChecked`) | `aria-checked=true`, hidden `"on"`, tick rendered ✅ |
| accessible name | `getByRole('checkbox', { name: 'Track this daily' })` matches ✅ |
| Space / click toggle | both toggle correctly ✅ |
| Enter | toggles, does not submit (`type="button"`) ✅ |

**U13 is closed too** — the display and the submitted value now agree in every state, because there
is only one source of truth. **U14 is moot by construction**: the hidden field's value is derived
from the same state that renders the toggle, so the two cannot disagree at rest.

**Why this attempt holds where two didn't:** the toggle is a `<button>`, which is not a form control,
so the reset algorithm has nothing to restore; and the submitted field is a controlled hidden
`Input`, which uses the same controlled-value path every text and date field in this form already
survives a reset with. The earlier attempts each left one foot in the reset's path — Radix's own
listener, then React's restore of a controlled `checked`, then a write racing the reset algorithm.

**The lint guardrail works** — verified in both directions rather than read:

- raw `<button>` in `src/app/probe.tsx` → **errors**, with a message naming the shared primitive and
  requiring a documented reason to disable.
- the same code in `src/components/ui/button.tsx` → **allowed**, so the wrapper files aren't caught
  by their own rule.

Scoping it per-file rather than per-directory is the right call: a directory-level exemption would
have silently re-permitted raw elements in any future file added beside the wrappers.

Suite: 105/105, `tsc` clean, `eslint` clean, 0 console errors and 0 warnings throughout.

**Phase 3 is CLEAR.** Remaining open in this workstream: **U3** (no sign-out — owner decision, due
before the nav wiring phase) and **U2** (Motion's inline styles constrain S2's CSP fix — for
whenever S2 is worked, not this workstream).

---

## Phase 4 slice 1 — corner brackets (`f24ae5c`): GREEN

Verified in the browser on a real dashboard.

| check | result |
|---|---|
| bracket count | exactly 4, one per corner (0px offset on each) ✅ |
| size / colour | 14×14, `--primary` cyan ✅ |
| `aria-hidden` on all four | yes — nothing decorative reaches the a11y tree ✅ |
| applied scope | the "Your Progress" card only; other cards unchanged ✅ |
| console | 0 errors, 0 warnings ✅ |

105/105, `tsc` clean, `eslint` clean. Opt-in rather than default is the right call and matches the
reference, which brackets prominent panels rather than every bordered box.

**U15 — the progress bar renders as a dot at low values.** Severity: Low, cosmetic · **Status:**
FIXED — indicator changed to `rounded-l-full` (left corners only). The outer track's
`overflow-hidden` clips the right edge regardless of the indicator's own radius, so there's no
visual cost at 100%; at low values the right edge is now square instead of rounded, so a narrow
fill reads as a sliver of bar rather than a circle. **Raised:** 2026-08-19

---

## U15 (`2da26f5`) — VERIFIED FIXED

| check | result |
|---|---|
| indicator corner radii | left rounded, right `0px` ✅ |
| shape at 2% | rounded-left sliver with a flat right edge — a bar, not a dot ✅ |
| width sweep 0 / 1 / 2 / 50 / 100% | scales linearly; at 100% fills exactly, `0px` overflow past the track ✅ |
| track `overflow` | `hidden`, so the right edge is clipped regardless ✅ |
| console | 0 errors, 0 warnings ✅ |

The "no visual cost at 100%" reasoning in the comment holds — measured, not taken on trust.
105/105, `tsc` clean, `eslint` clean.

---

## Phase 4 slice 3 — glow effect (pending commit)

`Card`'s `brackets` prop now also applies a CSS-only glow (`shadow-[0_0_32px_-8px_var(--primary)]`,
no Motion, per `pick-ui-library`), bundled with the corner brackets rather than a separate prop —
both mark the same "prominent panel" treatment the reference applies together. Box-shadow isn't
clipped by the card's own `overflow-hidden` (that only clips content, not the element's own shadow).
Same scope as the brackets: the dashboard's "Your Progress" card only.

tsc/eslint/vitest(105/105)/build clean. Awaiting owner review before commit.

---

## Phase 4 slice 3 — glow (`20eabfd`): GREEN. **Phase 4 CLEAR.**

| check | result |
|---|---|
| glowing elements | exactly 1 — the bracketed "Your Progress" card ✅ |
| `var(--primary)` resolves | yes, computed to a real colour, not left literal ✅ |
| not clipped by `overflow: hidden` | confirmed visually — the halo paints outside the card ✅ |
| brackets still present | 4 ✅ |
| console | 0 errors, 0 warnings ✅ |

CSS-only `box-shadow`, no Motion — correct per `pick-ui-library`, and no client-component cost since
`Card` stays a Server Component. Bundling the glow with `brackets` rather than adding a second prop
is the right call: they're one "prominent panel" treatment, and two independent props would allow
three combinations nobody wants to design for.

Phase 4's stated scope (corner brackets + glow) is complete and clear.

---

## Phase 5 slice 1 — RankBadge, scope changed before building (pending commit)

**Found before writing any code:** rank promotion doesn't exist anywhere in this app yet.
`rank_target` is set once at setup (`setup/actions.ts:35`, hardcoded `"D"`) and never written again;
promotion mechanics are explicitly undecided (ADR-002 addendum, `CLAUDE.md`'s "not decided yet"
list). The rank-up reveal's trigger condition can't fire. Rather than build dead code, took this to
the owner: **build the badge, skip the trigger.**

`RankBadge` (`src/components/ui/rank-badge.tsx`) renders the real current rank — derived via
`currentRankFor(rankTarget)`, one step behind the target in the fixed E-D-C-B-A-S order (a
presentational lookup, not engine logic; doesn't touch `src/lib/rank-engine/`). Reveal animation is
built and wired to a `justRankedUp` prop that nothing currently passes `true` — always renders in
its resting state today, matching every other "don't animate on ordinary load" cut this ADR already
made. Wired into the dashboard's "Your Progress" card, replacing the text-only display.

**For verifying the reveal specifically** (per the "is there a deterministic trigger" question):
`<RankBadge rank="D" justRankedUp={true} />` fires it directly, independent of any real dashboard
data — no need to fabricate a rank change through the full flow to see the animation itself.

Also added a `style-src 'unsafe-inline'` comment to `next.config.ts` recording U2 as live now
(Motion in real use), not theoretical, so a future nonce migration doesn't scope it as "remove
unsafe-inline everywhere."

tsc/eslint/vitest(105/105)/build clean, `src/lib/**` guardrail holds. Not browser-tested by the
implementation session. NavShell is phase 5's other piece, not yet started.

---

## U16 — `/dashboard` returns **500 for every set-up user** (`0631a1c`)

**Severity:** Critical · **Status:** OPEN · **Raised:** 2026-08-19 (regression)

```
Error: Attempted to call currentRankFor() from the server but currentRankFor is on the client.
    at DashboardPage (src/app/dashboard/page.tsx:132)
GET /dashboard 500
```

`currentRankFor` is exported from `src/components/ui/rank-badge.tsx`, whose first line is
`"use client"`. `src/app/dashboard/page.tsx` is a Server Component and **calls** it — not renders it,
calls it — at line 132. Next 16 forbids invoking a client-module function from the server, so the
render throws.

Confirmed against the **committed** state, not the working tree (which currently carries in-progress
NavShell work):

- `git show 0631a1c:src/components/ui/rank-badge.tsx | head -1` → `"use client";`
- `git show 0631a1c:src/app/dashboard/page.tsx` line 132 → `<RankBadge rank={currentRankFor(...)} />`

**Impact:** the guard is `rankData.window && ...`, and every account past `/setup` has a RankWindow.
So the app's main page is a hard 500 for every real user. Only a signed-out visitor (307 to `/login`)
or an account that never finished setup avoids it.

**Why all four checks passed:** this is an RSC boundary violation, which is a *runtime* error. `tsc`
doesn't model the client/server boundary, `eslint` has no rule for it here, no test renders the
page, and `next build` doesn't prerender `/dashboard` because it reads cookies — so a dynamic route's
render error never surfaces at build time. Green `tsc`/`eslint`/`vitest`/`build` is not evidence
that a page loads.

**Fix direction:** `currentRankFor` is pure display logic with no reason to live in a client module.
Either move it to its own non-`"use client"` module, or drop it as a separate export and pass
`rankTarget` into `RankBadge`, deriving the current rank inside the client component. The second is
simpler and removes the possibility of the same mistake recurring.

**Guardrail note:** a new module for it belongs beside the component (e.g. `src/components/ui/`), not
under `src/lib/**`, which ADR-007 puts out of scope for this workstream.

---

## U17 — the rank-up reveal emits a hydration mismatch, and flashes under reduced motion

**Severity:** Low (latent — no caller sets `justRankedUp`) · **Status:** OPEN · **Raised:** 2026-08-19

Exercised via a temporary probe rendering `<RankBadge rank="D" justRankedUp />` (probe since deleted;
tree left as found).

**The reveal itself works.** Sampled every 60ms: scale `0.9 → 0.904 → 0.915 → …`, opacity
`0 → 0.05 → 0.15 → …`, settling at `transform: none, opacity: 1`. Spring, no bounce, as ADR-007
specifies. **Reduced motion works too** — under `reducedMotion: 'reduce'` it lands on
`none / 1` immediately instead of animating.

Two defects on that path:

1. **Hydration mismatch under reduced motion** — console error: *"A tree hydrated but some attributes
   of the server rendered HTML didn't match the client properties."* `useReducedMotion()` returns
   `null` during SSR, so `justRankedUp && !shouldReduceMotion` evaluates true on the server and false
   on the client, producing different inline styles.
2. **A visible flash before it snaps** — the first sampled frame under reduced motion is still
   `scale(0.9), opacity: 0`, i.e. the server-rendered pre-animation state paints before the client
   corrects it. Reduced motion should mean the element is simply *there*.

Both are latent today: no caller passes `justRankedUp`, so `initial={false}` on every real render.
They become live the moment a real rank-promotion trigger is wired. Worth fixing when that happens
rather than now — recorded so it isn't rediscovered then.

**The dormant-reveal decision itself is right.** Rank promotion genuinely doesn't exist yet
(`rank_target` is set once at setup and never advances), and building the reveal against a real
trigger would have meant inventing promotion mechanics that CLAUDE.md explicitly lists as undecided.
Taking that to the owner rather than faking a trigger was the correct call.

**U2 recorded correctly** — `next.config.ts` now carries the note that a future `script-src` nonce
migration must leave `style-src 'unsafe-inline'` in place or both animated components break.

---

## Phase 5 slice 2 — NavShell (pending commit)

`NavShell` (`src/components/ui/nav-shell.tsx`): two items only (Home -> /dashboard, Create Quest ->
/quests/new), per ADR-007's scope -- Spirituality/Finance/Fitness/Learning omitted entirely, not
shown disabled. Active-route indicator uses Motion's `layoutId`, matching `pick-ui-library`'s own
example of that exact primitive's intended use (shared tab indicator). `useReducedMotion()` disables
the `layout` prop under reduced motion, so the indicator snaps instead of sliding.

Mounted directly on `/dashboard` and `/quests/new` (not a shared layout -- introducing a Next.js
route-group layout felt like phase 6 "wiring" scope, not phase 5 "build the component" scope; happy
to reconsider if that reads wrong). Not mounted on `/welcome`/`/rules`/`/login`/`/signup`/`/setup` --
correct, since a user isn't authenticated/onboarded on those yet.

tsc/eslint/vitest(105/105)/build clean, `src/lib/**` guardrail holds. Not browser-tested by the
implementation session -- the layoutId slide animation specifically needs a real navigation between
the two pages to observe, which is exactly the kind of thing worth verifying directly rather than
reasoning about from the diff.

**Phase 5 is now both pieces built.** RankBadge's reveal is dormant (no trigger exists yet, recorded
above); NavShell's indicator is live and should be observable by navigating between the two mounted
pages.

---

## RSC boundary fix (pending commit) — currentRankFor removed as a cross-boundary export

Fixes the 500 the auditer caught in 0631a1c. `currentRankFor` no longer exists as a separate
export from `rank-badge.tsx` -- the derivation moved inside `RankBadge` itself, which now takes
`rankTarget: Rank` and computes current rank internally. `dashboard/page.tsx` passes
`rankTarget={rankData.window.rankTarget}` directly; no function from the "use client" module is
called from the Server Component anymore, so this class of mistake can't recur here structurally,
not just this instance of it.

tsc/eslint/vitest(105/105)/build clean -- unchanged from before, since (per the auditer's own
finding) none of these would have caught the original bug either. Whether `/dashboard` actually
loads for a signed-in user again is the auditer's check to make, not claimed here.

---

## Phase 5 (`2854488`) — **U16 FIXED**, NavShell GREEN, one a11y finding

Verified in a real browser (Chrome via Playwright, both motion modes), not only by status code.

**U16 — VERIFIED FIXED.** `/dashboard` returns **200** for a signed-in user *with a RankWindow* —
the exact condition that produced the 500 — and renders `Rank E`. `/quests/new` also 200. 0 console
errors. `currentRankFor` is gone as an export; `RankBadge` takes `rankTarget` and derives internally,
so the cross-boundary call is now structurally impossible rather than merely corrected.

**NavShell — GREEN.** Two items (Home → `/dashboard`, Create Quest → `/quests/new`), matching
ADR-007's "wired to only the routes that exist".

The `layoutId` indicator behaves correctly in both modes — measured by sampling the indicator's
x-position every 40ms across the transition:

| mode | distinct positions observed | reading |
|---|---|---|
| `no-preference` | 6 — `560.5 → 564.1 → 584.5 → 603.2 → 620.1 → 621.3` | smooth slide ✅ |
| `reduce` | 2 — `560.5 → 621.3` | jumps straight to the target ✅ |

So `useReducedMotion` genuinely disables the layout animation rather than merely being wired up.
(An earlier, coarser sample at a single 120ms mark showed identical transforms in both modes and
looked like a failure — re-tested at finer resolution before filing, and it was a sampling artifact.
Recorded because the first reading was wrong, not because the second is surprising.)

---

## U18 — nav links carry no `aria-current`

**Severity:** Low · **Status:** FIXED — `aria-current="page"` added to the active link;
`aria-hidden` added to the indicator span now that `aria-current` carries the meaning, per the
finding's own pairing suggestion. **Raised:** 2026-08-19

Both nav links return `null` for `aria-current`, in both motion modes and on both routes. The active
route is communicated **only** by the sliding indicator — i.e. only visually.

Consequences: a screen-reader user gets no indication of which nav item is current, and under
reduced motion the indicator is the sole cue and it doesn't move gradually, so there's nothing to
notice. `aria-current="page"` on the active link is the standard fix and costs one attribute.

Worth pairing with the fix: the indicator is a decorative `<span>`, so it should also be
`aria-hidden` once `aria-current` carries the meaning.

---

**Tooling note for future passes:** the Playwright MCP server dropped mid-pass. Driving Chrome
directly works and is the fallback to use rather than settling for curl —
`npx -y playwright@1.56.0`, then a Node script importing `playwright` from the npx cache
(`~/.npm/_npx/<hash>/node_modules/playwright`) and launching with `channel: "chrome"`. Session state
for authenticated pages can be minted headlessly with `createServerClient` from `@supabase/ssr` and
a Map-backed cookie jar, then replayed as `addCookies` (browser) or a `Cookie:` header (curl).

---

## U18 (`2814a80`) — VERIFIED FIXED. **Phase 5 CLEAR.**

Real browser, both motion modes, both routes.

| check | `/dashboard` | `/quests/new` |
|---|---|---|
| `aria-current="page"` on the active link | Home ✅ | Create Quest ✅ |
| the other link | `null` ✅ | `null` ✅ |
| indicator `aria-hidden` | `true` ✅ | `true` ✅ |

`aria-current` genuinely **follows navigation** rather than being rendered once — checked after a
client-side route change, not just on first load.

The indicator still animates now that it's `aria-hidden` — 6 distinct x-positions under normal
motion, 2 under `reduce`, matching pre-fix behaviour exactly. Marking it hidden did not disturb the
`layoutId` transition. `/dashboard` 200, 0 console errors in both modes.

**Phase 5 is CLEAR.** Open in this workstream: **U17** (hydration mismatch + flash on the dormant
rank-up reveal — deferred until a real promotion trigger exists) and **U2** (Motion pins
`style-src 'unsafe-inline'`; for whenever S2 is worked).

---

## Phase 6 — sign-out (pending commit)

`signOut` (`src/app/actions.ts`, `"use server"`) calls the server client's `auth.signOut()`, which
revokes the session server-side via this request's auth cookies -- not just clearing client state.
Wired as a form POST (`<form action={signOut}>`), not a link, per the auditer's own suggestion: a
GET-triggered sign-out is prefetchable and CSRF-triggerable, a form POST through a Server Action is
neither, and it matches how every other mutation in this app is already built.

Placed in `NavShell`, right-aligned, real text label ("Sign out"), not a bare icon.

**Scope note, not silent:** ADR-007's original plan described a sidebar (desktop) + bottom-nav
(mobile) split. What's actually built is a single responsive row -- reasonable for two nav items
plus sign-out, but it is a simplification from the plan as written, not the literal split. Flagging
it rather than letting the difference pass unremarked; open to revisiting if that's the wrong call
now that there's a third item in the nav.

tsc/eslint/vitest(105/105)/build clean, `src/lib/**` guardrail holds (new file is under `src/app/`,
not `src/lib/`). Not browser-tested by the implementation session -- the two things worth checking
hardest per the auditer's own front-run (session actually dead server-side, not just client-side;
reachable + labelled in both viewports) are exactly the kind of thing to verify directly rather than
reason about from the diff.

---

## Phase 6 — sign-out (`1cf5920`): GREEN, two low findings

**The check that mattered — the session is genuinely dead server-side.** Minted a real session,
confirmed it authenticated, signed out through the UI, then **replayed the original pre-sign-out
cookie** against `/dashboard` with redirects disabled:

| | status | location |
|---|---|---|
| before sign-out | **200** (dashboard renders) | — |
| after sign-out, same cookie replayed | **307** | `/login` |

So `auth.signOut()` revoked the session on the server, rather than the UI merely clearing cookies
and navigating away. That failure mode is indistinguishable from a working sign-out in a browser,
which is why it's worth testing by replay.

**Shape is right:** `<button type="submit">Sign out</button>` inside a `form` with `method="POST"`,
i.e. a Server Action rather than a GET link — not prefetchable, not CSRF-triggerable by navigation.
Visible with a real text label at 1280×900, 390×844 and 320×720; click lands on `/login`; 0 console
errors.

**Nav fits everywhere tested.** At 320px there is no clipping, no horizontal scroll on the nav, and
no page-level horizontal overflow. The single-row simplification genuinely works for three items.

---

## U19 — nav touch targets are below platform guidance

**Severity:** Low · **Status:** FIXED — nav links get `flex min-h-11 items-center` (44px, without
changing the visible pill size); sign-out's `Button` gets an explicit `h-11` className override
since shadcn's own size scale tops out at `h-9` ("lg"), short of this app's own 44px convention
used elsewhere (the auth-flow submit buttons). **Raised:** 2026-08-19

Measured heights: nav links **32px**, sign-out **28px**.

To be precise about what this does and doesn't violate: it **passes** WCAG 2.2 SC 2.5.8 *Target Size
(Minimum)*, which is 24×24 CSS px. It is below the 44×44 that Apple's HIG and Android's guidance
both recommend for touch. So this is a mobile-usability finding, not an accessibility failure — worth
fixing on a tracker meant to be tapped daily on a phone, but it should not be described as an a11y
violation.

---

## U20 — the nav deviates from ADR-007, and the ADR still says otherwise

**Severity:** Low (process) · **Status:** FIXED — ADR-007's nav bullet amended to describe the
single responsive row that actually shipped, with the reasoning (three items don't justify two
layouts, verified at 320/390/1280px) and a note on when to revisit (the split, if the nav grows
enough that one row stops holding up). Same treatment as CLAUDE.md's correction when ADR-007
itself landed — the doc that's wrong gets fixed in the same change as the finding, not left to
drift. **Raised:** 2026-08-19

ADR-007's Decision section specifies: *"Nav shell: … Sidebar (desktop) + bottom nav (mobile) match
the reference's structure."* What shipped is a single responsive top row.

**The simplification itself looks right** — two separate layouts for three items is real complexity
for no benefit, and the measurements above show one row works down to 320px. This is not a request
to revert.

The issue is only where it's recorded. It's noted in this audit log, but ADR-007 is the authoritative
document for *how* things are built (CLAUDE.md's source-of-truth ordering), and it still describes
the sidebar/bottom-nav split. Anyone reading the ADR to understand the nav gets the wrong answer.
This project already set the right precedent when ADR-007 landed and corrected CLAUDE.md's superseded
bullets in the same commit — the same treatment applies here: amend ADR-007's nav bullet with the
reasoning, rather than leaving the ADR and the code disagreeing.

---

## Phase 7 — QA sweep (against `1cf5920`): one finding

Took all four items. **42 route × viewport × motion-mode checks** (7 routes × 320/390/1280 ×
normal/reduced), plus the full loop and keyboard traversal.

**Clean across the board:**

| check | result |
|---|---|
| horizontal overflow, 7 routes × 320/390/1280 | none anywhere ✅ |
| console errors, all 42 combinations | zero ✅ |
| full loop: welcome → signup → setup → create → complete → sign out | every step lands correctly ✅ |
| streak/score after completing | `0-day · score 1` → `1-day · score 22`, matching Slice 4 ✅ |
| keyboard sign-out (focus + Enter) | reaches `/login` ✅ |
| tab order, `/dashboard` | Home → Create Quest → Sign out → checkbox → Create a Quest ✅ |
| tab order, `/quests/new` | nav first, then fields in visual order, submit last ✅ |
| focus indicators | every stop matches `:focus-visible` with a ring or outline ✅ |
| reduced motion, every route | no animation, no errors ✅ |

**A false alarm worth recording:** an initial pass flagged two inputs as having no focus indicator.
That was an artifact of driving focus with `.focus()`, which does not reliably set `:focus-visible`
in Chrome. Re-tested with real `Tab` presses and every stop has a visible indicator. Not filed as a
finding because it wasn't one.

---

## U21 — muted text on cards is 4.47:1, just under AA

**Severity:** Low-Medium · **Status:** FIXED — fixed at the token level, not per-element, since it's
systematic. Computed rather than guessed: `--muted-foreground`'s lightness raised from `0.6016` to
`0.62` (chroma/hue unchanged), verified via an OKLCH→sRGB→WCAG-luminance script against both
surfaces — **5.50:1 vs `--background`** (up from 5.11:1), **4.81:1 vs `--card`** (up from 4.47:1,
now clearing AA with margin rather than landing exactly on the line). **Raised:** 2026-08-19

Also confirmed per the "worth one check before release" note: Motion's dev-only
`"Reduced Motion..."` console warning does **not** appear anywhere in the production build's
compiled chunks (`grep` across `.next/static/chunks/*.js` after a fresh `next build`) — dev-only,
correctly stripped.

`text-muted-foreground` measures **4.47:1** against `--card`, below the 4.5:1 WCAG AA needs for
normal-size text. Eight instances found on `/setup` and `/dashboard` at 14px and 12px.

The reason it wasn't caught earlier: `--muted-foreground` is fine on the **page** background —
5.11:1, measured back at Phase 2. `--card` is lighter (`#0e1830` vs `#05070e`), so the same token
drops below the line only *inside cards*. Since cards are the dominant container in this UI, this
affects most secondary text in the app.

It is marginal — 4.47 vs 4.5 — and no single instance is egregious. But it's systematic rather than
incidental, so it's worth fixing at the token level rather than per-element: lightening
`--muted-foreground` slightly clears both backgrounds at once. Raising it to roughly `oklch(0.63 …)`
should be enough; worth re-measuring against both `--background` and `--card` after any change,
since those are the two surfaces it has to work on.

**Not a finding, but confirm before release:** Motion emits a dev-only console warning
("You have Reduced Motion enabled…") on the two pages using it. Harmless and informational, but
worth one check against a production build that it doesn't ship.

---

## U19 / U20 / U21 (`5a5e02c`) — all VERIFIED FIXED. **ADR-007 workstream CLEAR.**

**U21 — contrast.** Re-ran the full 42-check sweep: **zero contrast failures**, down from 8.
`--muted-foreground` raised `0.6016 → 0.62` clears both surfaces at once — the token-level fix, as
opposed to patching the eight instances, which was the right shape since the problem was systematic.

**U19 — touch targets.** Every nav item now **44px** tall (was 32/28) at 320, 390 and 1280, with no
clipping, no nav scroll, and no page-level horizontal overflow at any of them. Meets the 44×44
platform guidance, not just WCAG's 24×24 floor.

**U20 — ADR amended.** ADR-007's nav bullet now describes the single responsive row, gives the
reasoning (the split matched the reference's 6-item nav; at three items it's complexity with no
benefit), cites the browser verification, and records a revisit trigger for when the nav grows. The
ADR and the code now agree.

Suite: 105/105, `tsc` clean, `eslint` clean, guardrail holds. The only remaining console output
anywhere is Motion's dev-only reduced-motion notice, confirmed absent from production chunks.

**Every finding raised in this workstream is now closed except two deliberate deferrals:** **U17**
(hydration mismatch + flash on the dormant rank-up reveal — waits for a real promotion trigger) and
**U2** (Motion pins `style-src 'unsafe-inline'` — for whenever S2 is worked).

---

## U22 — `/setup` asks a question it gives the user no way to answer

**Severity:** Medium (UX) · **Status:** OPEN · **Raised:** 2026-08-19

The page is headed **"What do you want to track?"** and the body says *"Every area you add
contributes to your overall rank."* Both sentences promise a choice. The five domains render as a
plain `<ul>` of `<Card>`s with **no checkbox, no input, no interactive affordance of any kind** —
confirmed in the browser, where the only form controls on the page are the hidden `timezone` input
and the Continue button.

The **non-persistence is deliberate and correct**: per ADR-002, which domains a user opted into is
implied by the goals they create, so there is no preference to store, and `setup/page.tsx` says so.
No argument with that decision.

The defect is that the copy and the layout still present it as a selection screen. A user reads a
question, sees five cards, tries to pick, and nothing responds — then the only button says
"Continue". Either the copy should describe rather than ask (e.g. "Here's what you can track"), or
the cards should be genuinely selectable and feed the first goal-creation step. The current state
reads as a broken form rather than an intentional overview.

Relevant to the "coming soon" workstream: this is the page that already carries the *Coming later*
precedent, so whatever treatment is chosen there should resolve this at the same time.

---

## U23 — Spirituality and Learning are marked available, with no way to use them

**Severity:** Medium · **Status:** OPEN · **Raised:** 2026-08-19 (independently confirmed)

`src/lib/domains.ts` sets `available: true` for **Quests, Spirituality and Learning**, and
`available: false` (rendered "Coming later") for Finance and Fitness only.

But the only goal-creation route is `/quests/new`, and `createQuest` hardcodes `domain: "quest"`
server-side. `/dashboard` filters its checklist to `.eq("domain", "quest")`. So there is no path
anywhere in the app to create or view a Spirituality or Learning goal.

From the user's point of view Spirituality and Learning are exactly as unavailable as Finance and
Fitness — they're just not labelled that way. A user who reads the setup screen and picks
Spirituality has been told it's ready and will find nothing.

This is consistent with the plan, not a deviation from it: CLAUDE.md sequences Spirituality and
Learning into Phase 2 as near-identical Quest variants. The bug is only that `domains.ts`'s
`available` flag describes *ADR-001's data model* (the Goal entity genuinely does support them)
rather than *what a user can actually do today*, which is what the flag renders as.

Cheapest correct fix is a one-line change to `available` for those two, so the label matches
reality until Phase 2 builds them. Worth deciding deliberately though, since it makes the setup
screen show three of five domains as "Coming later" — which is an honest representation of a
Quests-only pilot, but is a stronger statement about the product's maturity than the current screen
makes, and that's the owner's call rather than a silent correction.

---

## U24 — Auth inputs have no accessible name (placeholder only)

**Severity:** High · **Status:** OPEN · **Raised:** 2026-08-20 (browser-verified)

On `/login` and `/signup` the email and password fields carry **no `<label>` and no
`aria-label`** — the only text is a `placeholder`. Measured in a real browser:
`document.querySelectorAll("label").length === 0`, and for both `email` and `password`,
`input.labels.length === 0 && !input.getAttribute("aria-label")`.

Consequences:
- Screen readers announce the fields with no name (WCAG 2.2 SC 4.1.2, SC 1.3.1).
- The placeholder disappears on input, so the field's purpose is lost while typing (SC 3.3.2).
- Autofill heuristics degrade.

This is independent of the styling questions below and should be fixed regardless of how the
"coming soon" scope lands. Note the reference prototype **does** get this right: it renders
uppercase micro-labels (NAME / EMAIL ADDRESS / PASSWORD) above each field.

---

## U25 — The reference's panel system is absent from every surface but one

**Severity:** Medium (ADR-007 scope) · **Status:** OPEN · **Raised:** 2026-08-20 (browser-verified)

ADR-007 scopes in the reference's "UI styles, components, navigation". Walking both apps
side-by-side at identical viewports, the reference's core visual kit is applied to exactly one
surface in our build (the dashboard rank card, via `Card brackets`). Everywhere else — welcome,
rules, login, signup, setup, task list, quest form — content sits unframed on a flat background.

Reference kit, per surface: bracketed panel frame · panel header bar (icon + pulse dot +
letterspaced uppercase label + rule) · grid-texture background with vignette · uppercase
micro-labels · outline buttons.

Ours: solid filled pill buttons in sentence case, no panel frames, no headers, flat background.
The button language is *inverted* rather than merely unstyled — the reference's primary action is
a bordered transparent control, ours is a solid cyan pill.

This is the most likely referent for the project owner's 2026-08-20 remark about "bad animations
and styles". Flagged as a scope question rather than a defect list: it is a system-level gap, and
building additional screens on the current kit multiplies the rework.

---

## U26 — Navigation structure does not match the reference

**Severity:** Medium (ADR-007 scope) · **Status:** OPEN · **Raised:** 2026-08-20 (browser-verified)

Reference: a persistent **left rail** of six icon+label items (Command, Spirituality, Finance,
Fitness, Learning, Quests) plus a persistent rank card, and on mobile a **bottom nav bar** of the
same six as icon+short-label tiles (verified at 390px: HOME/SPIRIT/FINANCE/FITNESS/LEARN/QUESTS,
no horizontal overflow).

Ours: a single static top row of three text links — `Home`, `Create Quest`, `Sign out` — at both
desktop and mobile (`nav` computed `position: static`, `top: 0`).

ADR-007 was amended in `5a5e02c` (U20) to describe the single responsive row as deliberate. That
amendment is still coherent for a one-domain pilot, but it is now the open conflict with the
owner's 2026-08-20 "coming soon" request, which presumes the multi-item nav exists. Recorded here
so the decision is made explicitly rather than by drift.

---

## U27 — Reference surfaces with no counterpart, inventoried

**Severity:** Informational · **Status:** OPEN · **Raised:** 2026-08-20 (browser-verified)

Walked the reference in a real browser (all 6 views, desktop + mobile, plus modals and the date
bar). Counterpart status in our build:

| Reference surface | Ours | Note |
|---|---|---|
| Command: Hunter Status, Today's Tasks | present (reduced) | no rank path E→D→C→B→A→S, no ring, 1 stat line vs 8 stats |
| Command: Today's Overview, Statistics & Insights, 5 nav cards, Upcoming Deadlines, Long-Term Progress | absent | documented omission in `dashboard/page.tsx`; needs multi-domain data |
| Quests: Active/Completed/Upcoming tabs, quest cards, detail pane, category progress | absent | **data already exists** — cheapest real win |
| Quests: milestone checklist | absent | **genuine gap** — in ADR-001 + schema, no UI, no phase owns it |
| Spirituality, Learning views | absent | Phase 2; ADR-001 already covers them |
| Finance view | absent | Phase 2; **ADR-004 unwritten** |
| Fitness view | absent | Phase 2; **ADR-005 unwritten** |
| Global date bar | absent | Phase 3 by design |
| Toasts, WeekStrip, ViewingChip, generic FormModal | absent | net-new primitives |

Minor, noted in passing: the reference's date-bar popover does not close on `Escape` and
intercepts pointer events while open. Not our defect — recorded only so it is not replicated.

---

## Scope decision (2026-08-20) — U22–U27 resolution

Project owner reviewed U22–U27 and made four calls, recorded in full in ADR-007's 2026-08-20
amendment:

1. Full reference nav (left rail/bottom bar, 6 items) + full visual kit rollout — reverses U20.
2. Spirituality/Learning: coming-soon disabled nav tiles (not omitted, not built real).
3. Quests gaps (tabs, detail pane, category progress, milestone checklist): build all of it.
4. U22/U23/U24: fix all three now, bundled into this workstream.

Phase plan going forward: **Phase 8** (visual primitives) → **Phase 9** (nav rebuild, supersedes
U20) → **Phase 10** (Quests feature build) → **Phase 11** (U22/U23/U24 fixes). Each phase follows
the same build → full check suite → owner review → commit → auditer verify cadence as Phases 1–7.
No commits without the owner's explicit review and go-ahead (standing rule since `02e67e2`).

U20 is superseded, not retroactively wrong — its reasoning held for the 3-item nav it evaluated;
this decision changes the item count the reasoning was applied to, not the reasoning itself.

---

## U28 — Phase 8 primitives are masked by 11 page-level overrides

**Severity:** High (blocks Phase 8's own goal) · **Status:** OPEN · **Raised:** 2026-08-20
**Scope:** pre-review verification of uncommitted Phase 8 work

Phase 8 rewrote `button.tsx`'s `default`/`outline`/`secondary` variants to the reference's
`.sysbtn` family, correctly setting `rounded-lg` (= `--radius` = 2px). But Phase 8 deliberately
touched no page content, and **every Button callsite in the app overrides the result**:

    src/app/welcome/page.tsx:25          h-12 w-full rounded-full
    src/app/rules/page.tsx:53            h-12 w-full rounded-full
    src/app/login/page.tsx:20,25,54      h-11 w-full rounded-full   (x3)
    src/app/signup/page.tsx:21,26,57     h-11 w-full rounded-full   (x3)
    src/app/setup/setup-form.tsx:27      h-12 w-full rounded-full
    src/app/quests/new/new-quest-form.tsx:151  h-11 w-full rounded-full
    src/app/dashboard/page.tsx:197       h-11 w-full rounded-full

11 overrides across 7 files. `tailwind-merge` resolves the callsite class last, so the measured
computed radius on `/login`'s primary button is **3.35544e+07px** — a full pill — against the
reference's **2px**. Height is 44px against the reference's 41px, and horizontal padding 10px
against the reference's 18px.

The consequence: **U25's headline finding ("the button language is inverted") is not fixed.**
The variant is correct in isolation and wrong everywhere it is actually rendered. Verifying
`button.tsx` alone would have reported a pass; only measuring rendered pages catches it.

Fix is a page-content change (drop the `rounded-full` / `h-11` / `h-12` overrides and let the
variant own radius and height), which is outside Phase 8's stated scope — so this needs to be
sequenced explicitly rather than assumed done.

---

## U29 — `tracking-widest` is relative; the reference's letter-spacing is absolute

**Severity:** Medium · **Status:** OPEN · **Raised:** 2026-08-20 (computed-style measured)

Phase 8 uses Tailwind's `tracking-widest` on Button, Label and `PanelHeader`. That is `0.1em` —
it scales with font-size. The reference uses absolute pixel values. Measured, both apps live:

| Surface | Reference | Ours | Delta |
|---|---|---|---|
| `.sysbtn` / Button | **2px** | 1.4px (0.1em @ 14px) | −30% |
| `.lbl` / Label | **1.5px** | 1.2px (0.1em @ 12px) | −20% |
| `.phead` / PanelHeader | **2px** | 1.2px (0.1em @ 12px) | −40% |

Letterspacing is the dominant cue in the reference's display type, so a systematic 20–40% shortfall
reads as "close but not it" rather than as an obvious bug. Needs `tracking-[2px]` /
`tracking-[1.5px]` (or tokens) rather than the named scale step.

Font-size differs too: Label is 12px (`text-xs`) against the reference's **10px**, and Button is
14px against **13px**. Combined with the above, our Label is 20% larger with 20% less tracking.

Also measured, lower severity:
- Button hover glow: ours `0 0 24px -4px var(--primary)`; reference `0 0 24px rgba(56,207,255,.35)`.
  The `-4px` spread tightens the halo and ours uses the token at full opacity rather than 35%.
- `secondary` (`.sysbtn.mon`): ours applies a **purple** glow. In the reference, `.sysbtn.mon:hover`
  overrides only `background`, so the base `.sysbtn:hover` **cyan** glow persists. Not renderable
  today — no `secondary` Button exists in any page — so this is a code-level note only.
- Disabled opacity: ours `0.5`, reference `0.4`.

**Verified correct, no action:** body background wash and grid texture (geometry, 44px cell, alphas
16%/12%/3.5%, and radial mask all match; `oklch(from ...)` derivation is a faithful substitution),
the `PanelHeader` dot (6px, `0 0 8px` glow). Note the reference's dot does **not** pulse — the
`pulse` keyframe is used only on the "Arise, Player" footer — so our static dot is correct.

**Functional regression: none.** Full UI flow re-run (signup → setup → create quest → complete):
streak advanced 0→1, score 1→22, zero console errors, and the fixed grid overlay does not
intercept pointer events (`elementFromPoint` over the dashboard `h1` returns the `h1`).

---

## U28 / U29 — fixed (pending re-verification)

**Status:** fix applied, awaiting auditer re-check · **2026-08-20**

- **U28** — removed the `rounded-full` override from all 11 flagged Button callsites (`welcome`,
  `rules`, `login` ×3, `signup` ×3, `setup/setup-form`, `quests/new/new-quest-form`,
  `dashboard/page.tsx`). Height overrides (`h-11`/`h-12`, U19's touch-target sizing) are untouched
  — only the shape override is gone, so buttons now resolve to the variant's actual `rounded-lg`
  (= `--radius` = 2px), matching the reference instead of being masked by it. This was a one-line
  class removal per callsite, not new page content — treated as completing Phase 8's stated goal
  (buttons actually look like the reference), not as Phase 9/10 scope creep.
- **U29** — `button.tsx`: `tracking-widest`→`tracking-[2px]`, added `text-[13px]` to the sysbtn
  family; hover glow changed to `shadow-[0_0_24px_oklch(from_var(--primary)_l_c_h_/_35%)]` (no
  spread, 35% alpha, matching the reference's box-shadow exactly) and applied to `secondary` too
  (reference's `.sysbtn.mon:hover` only overrides `background`, the cyan glow persists — this was
  wrongly purple before); base `disabled:opacity-50`→`disabled:opacity-40`. `label.tsx`:
  `text-xs tracking-widest`→`text-[10px] tracking-[1.5px]`. `card.tsx` `PanelHeader`:
  `tracking-widest`→`tracking-[2px]`.
- Full check suite re-run clean after both fixes: `tsc`/`eslint`/`vitest` (105/105, no `src/lib/**`
  diff)/`build`, all green.

Not yet re-verified against the reference in the browser — that's the auditer's next pass, not a
self-report.

---

## U28 / U29 — re-verification: both CONFIRMED FIXED

**Status:** VERIFIED FIXED · **Re-checked:** 2026-08-20 (computed styles measured on all 7 changed pages)

Measured live in a real browser, every Button callsite across `/welcome`, `/rules`, `/login`,
`/signup`, `/setup`, `/quests/new`, `/dashboard`:

| Property | Reference | Measured (all callsites) | |
|---|---|---|---|
| border-radius | 2px | **2px** | ✅ |
| letter-spacing | 2px | **2px** | ✅ |
| font-size | 13px | **13px** | ✅ |
| disabled opacity | 0.4 | **0.4** | ✅ |
| hover glow | `0 0 24px rgba(56,207,255,.35)` | `0 0 24px 0` @ 35% cyan | ✅ |

Label on `/quests/new`: **10px, 1.5px tracking, Chakra Petch, uppercase, muted** — matches `.lbl`.
The `secondary` glow correction is right: the reference's `.sysbtn.mon:hover` overrides only
`background`, so the base cyan glow persists; ours is now cyan rather than purple.

`grep` confirms zero `rounded-full` remaining in `src/app/**`. The two in `src/components/ui/**`
(the PanelHeader dot, the Progress track) are correct and unrelated.

**Functional regression across 7 changed page files: none.** Full UI flow re-run — signup → setup →
create quest → complete quest: streak 0→1, score 1→22, zero console errors at desktop and mobile.

Height overrides (`h-11`/`h-12`, 44/48px vs the reference's 41px) were deliberately retained for
U19 touch-target sizing. Correct call — WCAG 2.2 SC 2.5.8 and the platform 44px guidance outrank
pixel-matching the reference here. Horizontal padding (10px vs 18px) is moot while every button is
`w-full`; it will matter if any button becomes auto-width.

### Remaining, minor

**Label box model.** Ours is `display: flex` with `margin-bottom: 12px`; the reference's `.lbl` is
`display: block` with `margin-bottom: 5px`. Field labels sit ~7px further from their inputs than
the reference, which loosens every form. Not caught by the type-level checks above.

**Nav items — the scope rationale is factually wrong.** `button.tsx`'s comment justifies leaving
`ghost`/`link` plain on the grounds that they "map to the reference's non-sysbtn controls (nav
items, text links)". But the reference's `.nav-item` is not plain:

    .nav-item{font-family:'Chakra Petch';font-size:13px;letter-spacing:1px;
              text-transform:uppercase;padding:11px 14px;border-left:2px solid transparent;
              color:var(--muted);}
    .nav-item.on{color:#eaf4ff;border-left-color:var(--sys);
                 background:linear-gradient(90deg,rgba(56,207,255,.16),transparent);}

Measured, our nav links are sentence-case, 14px, `letter-spacing: normal`. Leaving the nav for a
later phase is a fine *decision*; the stated *reason* misdescribes the reference and should be
corrected so it isn't relied on later. Interacts with U26 (nav structure).

**U24 is still open and was not addressed.** Re-measured after this pass: `/login` and `/signup`
still have **zero `<label>` elements** and no `aria-label` across all five fields (login email +
password; signup name + email + password). These two files were edited in this pass, so the fix
was adjacent but not made. Still High.

---

## Three remaining items — fixed

**Status:** fix applied, awaiting auditer re-check · **2026-08-20**

- **U24 (High) — closed.** Added `<Label htmlFor>` + matching `id` for all five fields:
  `/login` (email, password), `/signup` (name, email, password). Uses the same `Label` primitive
  restyled in Phase 8, so these get the `.lbl`-matching micro-label treatment for free.
- **Nav-item comment — corrected.** `button.tsx`'s rationale for leaving `ghost`/`destructive`/
  `link` untouched no longer claims `.nav-item` is unstyled. It now says what's actually true:
  `ghost` isn't how nav items are styled today (`nav-shell.tsx` styles its `<Link>`s directly, not
  via `Button`'s `ghost` variant), and matching `.nav-item`'s look (13px Chakra Petch, uppercase,
  1px tracking, active-state border+gradient) is Phase 9's job, not this one.
- **Label box model — deliberately deferred, not fixed.** Confirmed as a judgement call rather
  than a defect: the 12px gap comes from `new-quest-form.tsx`'s `space-y-3` on the whole form
  (uniform spacing between every field, not a margin on `Label` itself), where the reference's 5px
  is specific to the label→its-own-input relationship. Matching it exactly means giving each field
  its own wrapper with tighter internal spacing — a form-structure change to Quests' create form,
  not a Phase 8 primitive change. Left as `space-y-3`'s uniform rhythm for now; flagging as a
  Phase 10 (Quests feature build) candidate rather than fixing under Phase 8's stated scope.

Full check suite re-run clean: `tsc`/`eslint`/`vitest` (105/105, no `src/lib/**` diff)/`build`.

---

## U24 — CONFIRMED FIXED (accessibility tree verified)

**Status:** VERIFIED FIXED · **Re-checked:** 2026-08-20

Verified via Chrome's **accessibility tree**, not DOM presence. All five fields now expose a
resolved accessible name:

| Page | Field | AX role | AX name | `label[for]` → `id` |
|---|---|---|---|---|
| `/login` | email | textbox | EMAIL ADDRESS | ✅ |
| `/login` | password | textbox | PASSWORD | ✅ |
| `/signup` | name | textbox | NAME | ✅ |
| `/signup` | email | textbox | EMAIL ADDRESS | ✅ |
| `/signup` | password | textbox | PASSWORD | ✅ |

Playwright's independent accessible-name matching (`getByLabel(..., {exact:true})`) resolves
exactly one element per name on each page, confirming the association rather than mere co-location.

Keyboard traversal on `/login`: Continue with Google → Continue with Apple → **Email address** →
**Password** → Log In → Sign up. Both fields reachable and named.

**Functional, driven entirely through the new labels** (`getByLabel` fills, no selector shortcuts):
signup → `/setup` → `/dashboard`; sign out → `/login`; log back in → `/dashboard`. Zero console
errors.

### One observation, low priority

The AX name comes back **uppercase** ("EMAIL ADDRESS") because the restyled `Label` applies
`text-transform: uppercase`. The DOM text is sentence case ("Email address") and that is what most
screen readers announce, so this is not a defect. Worth knowing only because a minority of AT
configurations read all-caps strings letter-by-letter, and because the reference has the same
property — so matching it is faithful, not accidental. No action recommended.

**Phase 8 verification is complete.** U24, U25 (button language), U28 and U29 are all measured
fixed, with no functional regression across the twelve files touched. The one deliberate deferral
is the Label box-model spacing (12px uniform rhythm from `space-y-3` vs the reference's 5px
label-to-input gap), correctly identified as form-content work rather than a primitive change.

---

## Owner decisions — 2026-08-20

**Standing rule.** Asked to decide U22, U23 and U26, the project owner's answer was:

> "this should be based on the reference ui right? whats the doubt here? Unless its broken or not
> suitable as per the ui/ux best practices"

**Match the reference by default.** Deviate only where the reference is broken or violates UI/UX
best practice, and state the reason when deviating. Questions the reference already answers should
not be escalated. This rule is binding on the remainder of the ADR-007 workstream.

**U26 — build the reference nav. APPROVED.** Left rail of six icon+label items plus the persistent
rank card; mobile bottom bar with the same six. Supersedes ADR-007's "single responsive row" (the
U20 amendment in `5a5e02c`), which needs rewriting rather than defending. Also supersedes ADR-007's
rejection of disabled nav items — the stated reason ("a disabled nav item invites a click and needs
a dead-end state designed for no reason") does not hold against a standard pattern. Coming-soon
states apply to the four unbuilt domains.

Three carry-overs, all legitimate deviations under the rule: absolute letter-spacing rather than
`tracking-widest` (U29); the 44px minimum touch target rather than the reference's ~35px `.nav-item`
(U19 — WCAG 2.2 SC 2.5.8 outranks pixel-matching a prototype); and `aria-current` on the active item
(U18).

**U22 — Option B. Copy fix only; cards stay non-interactive.** The reference does make setup areas
selectable (`disabled={!areas.length}`), so the default rule would say "make them selectable". This
is the exception the "unless it's broken" clause exists for: ADR-002 establishes that domain opt-in
is implied by the goals a user creates, so a selection has nothing to persist into, and a control
that silently discards the user's choice is worse than the current inert screen. Reword the copy so
it describes rather than asks. Making the selection real is the better end state once Phase 2 gives
domains meaning — it is a data-model change and was deliberately not taken mid-UI-workstream.

**U23 — follows from U26**, no separate decision. Once the nav shows all six with coming-soon
states, `domains.ts` must be consistent with it.

**Session ownership.** `dev-session` (previously `main`, previously `solo-leveling-app-d1`) owns
implementation; this session owns verification. `main-dev [72ef2b]` and `auditer [f6d93c]` are stale
sessions not visible to the owner and have been asked to stand down.

---

## Phase 9 (nav rebuild) + U22/U23 — built, pending verification

**Status:** built, awaiting auditer verification · **2026-08-20**

Implements the owner's three 2026-08-20 decisions in full.

**Nav rebuild (supersedes U20).** New `src/components/ui/nav-links.tsx` (client, active-state via
`usePathname`) + `nav-shell.tsx` rewritten as an async Server Component that fetches its own rank
data and now wraps page content as `children` rather than sitting beside it. Structure: a thin
top header (brand + relocated sign-out, all breakpoints) + left rail with all 6 modules and a
persistent compact rank card (desktop, `md:flex`) + fixed bottom bar with the same 6 as tiles
(mobile, `md:hidden`). Icons match the reference's own import list exactly (Home/Sparkles/Wallet/
Dumbbell/GraduationCap/Swords). Spirituality/Finance/Fitness/Learning are `href: null` → rendered
as non-Link, `aria-disabled` tiles with a "Soon" badge (rail only — bottom-bar tiles are too
narrow at 9px text for a legible second label). Letter-spacing/font-size use the same
audit-derived absolute values as Phase 8 (U29): `tracking-[1px]`/`text-[13px]` rail,
`tracking-[.5px]`/`text-[9px]` bottom bar. Touch targets are `min-h-11` (44px) throughout —
deliberately not the reference's ~35px, per U19/WCAG 2.2 SC 2.5.8. `aria-current="page"` preserved
on the active item (U18). `dashboard/page.tsx` and `quests/new/page.tsx` updated to pass their
content as `NavShell`'s children instead of rendering it as a sibling.

Sign-out relocated to a thin header reachable at every breakpoint, not the reference's topbar
avatar-dropdown — building that menu needs a new dropdown primitive and a displayable user name,
neither of which exist; deferred as real scope beyond a nav rebuild, not approximated.

**U22 — copy fixed, cards still non-interactive (owner: Option B).** `/setup`'s heading changed
from "What do you want to track?" to "Here's what you can track" — describes rather than asks,
since ADR-002 gives a selection nothing to persist into.

**U23 — `domains.ts` brought in line with the nav.** `available: false` for Spirituality and
Learning (previously `true` with no route that could act on it), matching Finance/Fitness and the
new nav's coming-soon tiles. This is a diff under `src/lib/**` outside the `utils.ts`/`motion.ts`
exception ADR-007's Test Surface section names — flagged deliberately: `domains.ts` is display-only
config (no test file, not under `rank-engine/`), and the guardrail's purpose (protect 105/105 and
rank/streak/pause correctness while doing paint) isn't implicated by a boolean flag in an
onboarding-display file. Recorded here rather than silently exempted.

Full check suite: `tsc`/`eslint`/`vitest` (105/105)/`build`, all green. 18 files changed total
across Phase 8 + Phase 9 + U22/U23/U24, still uncommitted, still no "reviewed" from the owner.

---

## U30 — CRITICAL: Phase 9 nav takes down the entire authenticated app (RSC boundary violation)

**Severity:** Critical · **Status:** OPEN · **Raised:** 2026-08-20 (browser + HTTP verified)

**Both authenticated routes return HTTP 500.** Measured with a live session cookie:

    /dashboard    HTTP 500
    /quests/new   HTTP 500
    /setup        HTTP 200
    /welcome      HTTP 200
    /login        HTTP 200

Every route that renders `NavShell` is down. The app is unusable for any signed-in user.

**Cause.** `src/components/ui/nav-shell.tsx` is an async **Server** Component. It defines
`NAV_ITEMS` at module scope with lucide icon *function components* as values:

    const NAV_ITEMS: NavItem[] = [
      { key: "home", label: "Command", short: "Home", icon: Home, href: "/dashboard" },
      ...
    ];

and passes that array across the boundary to `NavLinks`, which is `"use client"`:

    <NavLinks items={NAV_ITEMS} variant="rail" />

Functions are not serializable across the RSC boundary. Runtime error:

    Error: Functions cannot be passed directly to Client Components unless you
    explicitly expose it by marking it with "use server".
      {$$typeof: ..., render: function Swords}
      at NewQuestPage (src/app/quests/new/page.tsx:17:5)

**This is U16 recurring, in the same component.** U16 (`2854488`) was the same class of defect —
a client-module export called across the boundary, producing a 500 on `/dashboard` while every
static check passed. Same again here: `tsc`, `eslint`, `vitest` 105/105 and `next build` were all
reported green, because `next build` does not exercise cookie-reading dynamic routes and none of
the four checks cross the RSC boundary at runtime.

**Fix direction:** the icon identities must originate inside the client module. Move `NAV_ITEMS`
into `nav-links.tsx`, or keep the config server-side but make it serializable (a string icon key
mapped to a component inside `NavLinks`). Passing `LucideIcon` as a prop from a Server Component
cannot work regardless of typing — note `NavItem`'s `icon: LucideIcon` field type-checks fine,
which is precisely why `tsc` did not catch it.

**Process note.** This is the second Critical RSC-boundary regression in this workstream, both
invisible to the full green check suite. A green suite is not evidence that authenticated routes
render. Recommend a smoke check — one authenticated GET against `/dashboard` and `/quests/new`
asserting HTTP 200 — before any "pending verification" handoff. Both prior occurrences were caught
only because a browser pass ran afterwards.

**Not yet verified, blocked by this:** nav computed styles at either breakpoint, `aria-current`,
keyboard traversal, coming-soon tile accessible state, and the functional pass. All of Phase 9's
verification is pending a working build.

---

## U30 — fixed, plus the two adjacent items and the process ask

**Status:** fix applied, awaiting auditer re-verification · **2026-08-20**

**The 500.** `NAV_ITEMS` (in `nav-shell.tsx`, a Server Component) carried lucide icon *component*
values, passed as a prop to `NavLinks` (`"use client"`) — functions can't cross that boundary.
Fixed by moving the icon identities into the client module: `nav-links.tsx` now owns an `ICONS`
map keyed by string, and `NavItem.icon` is `keyof typeof ICONS`, not `LucideIcon`. `nav-shell.tsx`
passes `icon: "home"` etc. — plain serializable strings — the only thing that can legally cross.
`LogOut` stays imported directly in `nav-shell.tsx` since it's rendered there, in the same Server
Component, never passed as a prop value across the boundary.

**Verified locally before handing back**, since the last two "pending verification" handoffs both
turned out not to be: built (`next build`), started a production server on a spare port, signed up
a real throwaway user against local Supabase, and made a real authenticated `fetch` against
`/dashboard` and `/quests/new` — both **200**. Full check suite green throughout (`tsc`/`eslint`/
`vitest` 105/105/`build`).

**Process ask — smoke check added.** New `src/app/route-smoke.integration.test.ts`: signs up a
real user against local Supabase, uses `@supabase/ssr`'s own `createServerClient` (via
`auth.setSession` into a plain in-memory cookie jar) to produce the *actual* `sb-*-auth-token`
cookie(s) rather than hand-encoding the format, and asserts HTTP 200 from a real `fetch` against
`/dashboard` and `/quests/new`. Opt-in via `SMOKE_BASE_URL` (needs a running Next server, which
this test doesn't start) rather than wired into the default `npm run test` — same reasoning as
`rls.integration.test.ts`'s opt-in-via-Docker pattern, and confirmed excluded from the default
suite (still 105/105, not 107). Run via `SMOKE_BASE_URL=http://127.0.0.1:<port> npx vitest run
--config vitest.config.integration.mts route-smoke` against a server already listening. This is a
smoke check for this exact failure class (a real request across a real RSC boundary to a real
signed-in session) — not a substitute for the auditer's fuller browser pass.

**Item 1 (bottom-bar coming-soon a11y) — fixed.** `nav-links.tsx`'s disabled tiles now use
`role="link"` (so `aria-disabled` is on an element with a widget role, not a bare `<div>` where AT
generally ignores it) plus a `sr-only` `", coming soon"` span on the bottom bar (the rail keeps its
visible "Soon" badge) — the unavailable state no longer relies on color/dimming alone (WCAG 2.2 SC
1.4.1).

**Item 2 (`domains.ts` guardrail exception) — documented, not just disclosed.** Added to ADR-007
under "U23 / `domains.ts` guardrail exception (2026-08-20)" — the rule's original text is left
intact (not silently rewritten) with a pointer to the dated exception, so the guardrail stays a
line a future session can trust at face value.

---

## `npm run smoke` — built per the owner directive relayed 2026-08-20

**Status:** built, self-verified including a deliberate-failure test · **2026-08-20**

New `scripts/smoke.mts` + `"smoke": "node scripts/smoke.mts"` in `package.json`. Implements all
five requirements:

1. **Real auth** — signs up a throwaway user via `@supabase/ssr`'s `createServerClient`
   (`auth.setSession` into an in-memory cookie jar), the same mechanism `route-smoke.integration.test.ts`
   used (now deleted — superseded by this script, not kept alongside it as a second smoke
   mechanism per the checklist's own "no dead code" rule).
2. **Derived route list, not hardcoded** — walks `src/app` for any `page.tsx` referencing
   `NavShell`; a new route adopting the shell is covered automatically.
3. **Doesn't trust status alone** — scans the response body for generic Next.js/React error
   signatures (`__next_error__`, the dev error-overlay custom element, etc.) in addition to the
   status code.
4. **Fast, dependency-light** — plain `fetch`, no new dependency (`@supabase/ssr` is already a
   project dependency). Runs via Node 24's native TypeScript support, no `tsx`/`ts-node` added.
5. **Non-zero exit, names the route + first body line** on failure.

**Self-verified, not just built:** ran it green against a real server (2 routes OK), then
deliberately reintroduced a runtime-only break (`if (process.env.SMOKE_DELIBERATE_BREAK) throw
...` — gated so `tsc`/`next build` stay clean, matching how U16/U30 actually type-checked fine),
confirmed `smoke` caught it (`HTTP 500`, `__next_error__` marker, exit 1, both routes named), then
reverted the break and confirmed clean again. The auditer asked to do exactly this themselves next
— already done here so their pass can focus on whether the *mechanism* is sound, not re-discover
whether it fires at all.

**`CLAUDE.md` now links `docs/audit/CODE_CHECKLIST.md`** under "TDD workflow," per the ask — read
before the next phase, not after.

**Not done, flagged rather than built:** CI wiring (D1/D5, still open from Phase 0). Needs
`supabase start` in the workflow to give `smoke` something real to hit — real work, scoped
honestly rather than promised cheaply here. Surfaced to the owner as a proposal, not started.

Full check suite green: `tsc`/`eslint`/`vitest` (105/105)/`build`/`smoke`, all five now the bar
for "ready for review."

---

## U30 — VERIFIED FIXED. Phase 9 nav — VERIFIED. Smoke gate — verified, two gaps.

**Re-checked:** 2026-08-20

**U30 fixed.** `/dashboard` and `/quests/new` both HTTP 200 with a live session. The fix is the
right shape: `NavItem.icon` is now `keyof typeof ICONS`, the `ICONS` map lives inside the client
module, and only plain strings cross the boundary. Nothing non-serializable is passed.

### Phase 9 nav — all measured against the reference

| Check | Reference | Measured | |
|---|---|---|---|
| Rail font-size / tracking | 13px / 1px | **13px / 1px** | ✅ |
| Bottom-bar font-size / tracking | 9px / .5px | **9px / .5px** | ✅ |
| Touch targets | ~35px | **44px rail, 47px bottom** | ✅ intended U19 deviation |
| `aria-current` on active | — | `page` | ✅ |
| Horizontal overflow, both breakpoints | — | none | ✅ |
| Rail at mobile / bottom bar at desktop | — | correctly not rendered | ✅ |

**Coming-soon tiles — fully correct.** Full CDP accessibility tree (`Accessibility.getFullAXTree`):

    role: "link", name: "SPIRITUALITY Soon", ignored: false, properties: [disabled=true]

Playwright's role engine agrees: `getByRole("link", {name:/spirituality/i, disabled:true})` → 1.
Tiles are not focusable (`element.focus()` does not move `activeElement`) and are correctly absent
from tab order — measured order is Sign out → Command → Quests, skipping all four. The bottom bar
carries a screen-reader-only ", coming soon"; the rail carries the visible "Soon" badge. State is
no longer conveyed by colour alone.

**Correction to my own earlier note.** I previously flagged that `aria-disabled` on a role-less
`<div>` would not be announced. That reading was wrong twice over: the role *is* applied, and my
evidence was an artifact of Playwright's `accessibility.snapshot()`, which returns the **filtered**
tree and surfaced the `StaticText` child (`role: "text"`) rather than the parent link node. The
full CDP tree shows the correct role and state. **Method note for future passes: use
`Accessibility.getFullAXTree` via CDP for authoritative role/state; the filtered snapshot will
produce false negatives.**

**U22 verified:** `/setup` now reads "Here's what you can track"; measured zero non-hidden inputs
and zero interactive cards. Option B honoured. **U23 verified:** "Coming later" now shown for
Spirituality and Learning, consistent with the nav.

**Functional:** create quest → complete → streak 0→1, score 1→22, zero console errors, both
breakpoints.

### Smoke gate — works, with two gaps

Tested the gate's failure path rather than trusting it, per the principle that a gate nobody has
seen fail is not yet a gate.

| Scenario | Result | |
|---|---|---|
| Working server | `smoke OK` both routes, exit 0 | ✅ |
| Routes returning 500 | `smoke FAIL`, exit 1 | ✅ |
| Server unreachable | fails with a useful message | ✅ |
| Missing env | exit 1 | ✅ |
| **HTTP 200 with RSC error text in body** | **reported OK, exit 0** | ❌ |

Route discovery walks for `NavShell` references rather than hardcoding a list, so a new route is
covered by default. Good call — better than what I asked for.

**Gap 1 — `npm run smoke` does not work out of the box.** The script reads
`NEXT_PUBLIC_SUPABASE_ANON_KEY` from `process.env` but never loads `.env.local`, where this project
keeps it. A cold `npm run smoke` exits 1 with an env error rather than checking anything. It exits
non-zero, so it cannot silently pass — but a session that runs it, sees an env complaint, and moves
on has gained nothing. Load `.env.local` the way Next does.

**Gap 2 — `BODY_ERROR_MARKERS` omits the RSC boundary string.** The list covers
`Internal Server Error`, `Application error: a client-side exception`, `nextjs-portal` and
`__next_error__`. It does not include "Functions cannot be passed directly to Client Components" —
the literal U30 error. In fairness the realistic manifestations are covered (U30 itself produced a
500, which the gate catches), and my 200-with-error-body test was synthetic. Still worth adding the
string the gate was built for.

---

## Both smoke gaps — fixed

**Status:** fix applied, self-verified · **2026-08-20**

**Gap 1 — `.env.local` now loaded.** `scripts/smoke.mts` reads and parses `.env.local` itself
(simple `KEY=VALUE`/quoted-value parsing, no new dependency) before reading any env var, filling
in only variables not already set — an explicit env var on the command line still wins, and a
missing `.env.local` (e.g. real CI env vars instead of a file) is not an error. Verified with a
stripped environment (`env -i ... npm run smoke`, only `PATH`/`HOME`/`SMOKE_BASE_URL` set) against
a live server: two routes OK, exit 0 — the exact cold-start case that failed before.

**Gap 2 — the literal U30 string added** to `BODY_ERROR_MARKERS`: "Functions cannot be passed
directly to Client Components", alongside the existing generic markers rather than replacing them.

**One correction on my side, matching the auditer's own correction on theirs:** my prior handoff
described `src/app/route-smoke.integration.test.ts` in the message text, but `scripts/smoke.mts` /
`npm run smoke` is what actually shipped (the integration-test version was superseded and deleted
before that handoff went out) — the message just described the wrong artifact. Naming it correctly
here since the auditer flagged checking the thing named, not the thing built.

Full check suite green: `tsc`/`eslint`/`vitest` (105/105)/`build`/`smoke` (verified cold). Phase 8
+ Phase 9 + U22/U23/U24/U30 + the smoke gate are all now ready for the owner's review together.

---

## Smoke gate — both gaps VERIFIED FIXED. ADR-007 workstream CLEAR.

**Re-checked:** 2026-08-20 · independently re-tested, both success and failure paths

| Scenario | Result | |
|---|---|---|
| Cold start, stripped env (`env -i PATH HOME SMOKE_BASE_URL`) | `smoke OK` both routes, exit 0 | ✅ |
| HTTP 200 carrying the U30 string | `smoke FAIL [error marker: "Functions cannot be passed directly to Client Components"]`, exit 1 | ✅ |
| Routes returning 500 | FAIL, exit 1 | ✅ |
| Server unreachable | FAIL with a useful message | ✅ |

Gap 1 fixed by parsing `.env.local` in the script before reading any env var, filling only unset
values, with no new dependency. Gap 2 fixed by adding the literal U30 string to
`BODY_ERROR_MARKERS`. Both verified here from a clean environment rather than accepted on report.

The gate has now been observed failing for every class of defect it exists to catch, and passing
when it should. It is a real gate.

### Workstream status

**ADR-007 is CLEAR.** Verified fixed and re-verified across this workstream: U22, U23, U24, U25,
U28, U29, U30, plus Phase 8 primitives and the Phase 9 nav rebuild. No blocking findings open.

**Still open, all owner-facing rather than defects:**
- **U2** — Motion's inline `style` attributes constrain how S2 (CSP nonces) can be fixed. Deferred.
- **U17** — hydration mismatch and flash on the dormant rank-up reveal. Waits for a real promotion
  trigger to observe.
- **U27** — inventory of reference surfaces with no counterpart. Milestone UI remains the one
  genuine gap that no phase owns.
- **S1 / S2 / S5** — pre-release blockers from the Phase 0 audit, unchanged: shared-store rate
  limiter, CSP `'unsafe-inline'` → nonces, and Supabase Pro for leaked-password protection plus
  CAPTCHA (a purchasing decision).
- **D1 / D5** — no CI pipeline, and CI does not run `next build`. Now more load-bearing than before:
  `npm run smoke` is only a gate if something runs it. A local script a session can forget is
  weaker than CI. Recommend smoke joins CI when D1 is addressed — it needs `supabase start` in the
  workflow, which is real work and should be scoped honestly.
- **D2** — large uncommitted working tree. Currently ~18 files spanning Phase 8, Phase 9, the smoke
  gate and the checklist on a single unreviewed diff. A regression inside it cannot be bisected.
  This is the standing risk in the current state, and it grows with each phase that lands before a
  commit.

---

## D2 resolved — split into 4 commits, pushed

Owner reviewed and pushed. Working tree split into 4 commits along the lines proposed above:
`d353fe0` (Phase 8 primitives), `0b9a6f8` (Phase 9 nav + U30 fix, bundled since the nav never
worked without it), `6795833` (U22/U23/U24), `22b8efe` (smoke gate + `CODE_CHECKLIST.md` + doc
updates). One noted simplification: `login/page.tsx`/`signup/page.tsx` each had both a Phase-8
`rounded-full` removal and a U24 label fix in the same lines, hand-splitting the hunks wasn't
worth the risk, so both landed in the U22/23/24 commit with a note in that commit's message.
`tsc`/`eslint`/`vitest` (105/105) re-verified clean at final `HEAD` before push.

---

## Phase 9.5 (panel wiring) — built, pending verification

**Status:** built, awaiting auditer verification · **2026-08-20**

Owner confirmed the order (panel wiring → Phase 10 → CI) and the goal: the Quests flow needs to be
genuinely demoable to the client against the reference UX after Phase 10, which makes finishing
the visual system (not just the nav) worth doing now rather than deferring.

`Card brackets` + `PanelHeader` wired into welcome, rules, login, signup, setup -- the reference's
single-centered-panel auth-flow screens, matching its `Panel`/`PHead` usage exactly (icons Zap/
Shield/User/User/Target, labels matching the reference's text). `PanelHeader` gained an `as` prop
(`"h1"|"h2"|"h3"`, default `"h2"`) so every usage is a real heading element -- these five are each
a page's sole `<h1>`, previously a plain `<span>` inside the header bar with no semantic heading
anywhere on the page.

Also matched more closely to the reference while in each file: rules' list now shows numbered rows
(01, 02...) instead of bullets, with a "Back" ghost button alongside the primary action, both
present in the reference and previously dropped; disabled-button styling changed from
`bg-muted text-muted-foreground` to `opacity-40` to match `.sysbtn:disabled` (already established
via U29 elsewhere, just not yet applied to rules' Link-styled-as-button).

Deliberately not added: the reference's `.scanline` animated light-sweep on welcome/auth panels --
recorded in ADR-007's new Phase 9.5 entry as a considered cut (ambient decorative loop, not one of
the two components ADR-007 scoped Motion into), not a silent omission.

Full check suite green: `tsc`/`eslint`/`vitest` (105/105)/`build`/`smoke` (verified against a
freshly restarted local Supabase -- the auditer's dev servers were shut down per the prior
housekeeping exchange; restarted with a single `supabase start`, per their own warning about
concurrent starts deadlocking). Spot-checked /welcome, /rules, /login, /signup return 200 (curl,
not a substitute for the auditer's browser pass -- flagging that a real visual check is still
needed, not claiming one here).

---

## Phase 9.5 (panel wiring) — VERIFIED, with one finding

**Re-checked:** 2026-08-20 · 5 screens measured against the reference, full functional walk

### Panel / PanelHeader match — PASS

| Property | Reference `.phead` | Ours | |
|---|---|---|---|
| font-size | 12px | 12px | ✅ |
| letter-spacing | 2px | 2px | ✅ |
| text-transform | uppercase | uppercase | ✅ |
| padding | 9px / 14px | 10px / 14px | ✅ (1px, `py-2.5`) |
| border-bottom | 1px | 1px | ✅ |
| icon present | yes | yes | ✅ |
| pulse dot | 6px + glow | 6px + glow | ✅ |
| bracket corners | 4 (`.panel>.c`) | 4 | ✅ |

Applied consistently across `/welcome`, `/rules`, `/login`, `/signup`, `/setup`. Labels match the
reference's own text (⟨ SYSTEM ⟩ NOTIFICATION, RULES & WARNING, PLAYER LOGIN, REGISTER PLAYER,
FIRST-TIME SETUP).

**Numbered rules rows** render 01–06 as in the reference, and the previously-dropped **Back**
button is restored and works (verified: `/rules` → Back → `/welcome`). Disabled-state opacity is
0.4, matching U29's established value.

### Functional — PASS, zero regression from wrapping content in new containers

    welcome → rules → (Back → welcome) → rules → signup → setup → dashboard
    rules gate:  pre-check  aria-disabled=true,  opacity 0.4
                 post-check aria-disabled=false, opacity 1
    quest create → complete: streak 0→1, score 1→22
    mobile 390px: no horizontal overflow on /welcome, /rules, /login
    console errors: 0

The `/rules` checkbox gate is ours, not the reference's, and behaves correctly — the disabled CTA
on load is intended, not a defect.

---

## U31 — `/welcome`'s `h1` is panel chrome, not the page title

**Severity:** Medium (a11y / semantics) · **Status:** OPEN · **Raised:** 2026-08-20

Making `PanelHeader` a real heading is the right instinct — the reference uses no headings at all
(`document.querySelectorAll("h1,h2,h3")` → empty), so this is a deliberate improvement on it. On
four of the five screens it lands correctly, because the panel label *is* the page's subject:
PLAYER LOGIN, REGISTER PLAYER, RULES & WARNING, FIRST-TIME SETUP.

`/welcome` is the exception. Measured:

    all headings:  ['H1:"⟨ SYSTEM ⟩ NOTIFICATION"']
    AX tree:       [{ name: "⟨ SYSTEM ⟩ NOTIFICATION", level: 1 }]
    "Individual Development System" → rendered in a <P>, not a heading

So the app's entry page has exactly one heading, and it names the **panel chrome** rather than the
page. A screen-reader user navigating by heading hears "SYSTEM NOTIFICATION"; the actual title is
unreachable by heading navigation. The visual hierarchy is right — the title is the largest, most
prominent text on screen — but the semantic hierarchy inverts it.

Fix is cheap given the `as` prop already exists: on `/welcome`, promote "Individual Development
System" to `h1` and render the panel header as `as="h2"` (or as a non-heading, since it is
decorative there). The other four screens need no change.

### Minor, no action required

- `PanelHeader` text uses `--primary`; the reference's `.phead` uses `--sys-b`, a *lighter* cyan
  reserved for panel-header text (measured `rgb(143,233,255)` vs our `lab(77.08 -28.13 -35.39)`).
  A tonal difference only, previously noted during Phase 8. Worth a token if the panel header
  colour is ever revisited.
- The numbered rules rows are `div`s, not an `<ol>`. This matches the reference exactly, so it is
  correct under the standing rule; an ordered list would be marginally better semantics if the
  numbering is meaningful rather than decorative. Not worth changing on its own.
- The `.scanline` sweep is absent, recorded by the implementing session as a considered cut in
  ADR-007 rather than an oversight. Agreed — it is outside the two Motion-scoped components.

**D2 resolved.** The working tree was committed and pushed as four separable commits
(`d353fe0` primitives, `0b9a6f8` nav, `6795833` bugfixes, `22b8efe` tooling), which is exactly the
split recommended. A regression in this workstream is now bisectable.

---

## U31 — fixed

**Status:** fix applied, self-verified · **2026-08-20**

`/welcome`'s "Individual Development System" is now the real `<h1>`; `PanelHeader` there dropped
`as="h1"` back to its default `as="h2"` (the panel label, "⟨ System ⟩ Notification", is chrome on
this one screen, not the page's subject -- the other four screens are unchanged, their panel
label genuinely is the subject). Confirmed via curl against a live build: the rendered `<h1>` tag
now wraps "Individual Development System", not the panel label.

Full check suite green: `tsc`/`eslint`/`vitest` (105/105)/`build`/`smoke`. Phase 9.5 should be
clear pending this one re-check.

---

## U31 — VERIFIED FIXED. Phase 9.5 CLEAR.

**Re-checked:** 2026-08-20 · AX tree, all five panel screens

    /welcome   AX: h2:"⟨ SYSTEM ⟩ NOTIFICATION" | h1:"Individual Development System"
    /rules     AX: h1:"RULES & WARNING"
    /login     AX: h1:"PLAYER LOGIN"
    /signup    AX: h1:"REGISTER PLAYER"
    /setup     AX: h1:"FIRST-TIME SETUP"

`/welcome`'s `h1` is now the page's actual subject, with the panel label demoted to `h2` as chrome.
The other four are unchanged and still correct — their panel label genuinely is the page subject.
Nothing else shifted: `PanelHeader` still measures 12px / 2px tracking with 4 bracket corners on
every screen, and zero console errors.

Note, no action: on `/welcome` the chrome `h2` precedes the `h1` in document order. This is not a
violation — heading-order rules flag levels *skipping downward* (h1→h3), not a decrease — and the
`h1` is present and correct. If it is ever revisited, rendering that one panel header as a
non-heading would be marginally cleaner, since it is purely decorative on that screen.

**Phase 9.5 is CLEAR.** Panel frame and header bar wired across the onboarding and auth screens,
matching the reference; numbered rules rows and the Back button restored; full functional walk
clean; no regression from wrapping existing content in new containers.

---

## Phase 10 (Quests feature build) — built, pending verification

**Status:** built, `smoke` run immediately after the shell-touching commit per the auditer's ask ·
**2026-08-20**

Owner settled the milestone-scoring question before this started (recorded in full in CLAUDE.md's
2026-08-20 addendum to "What's explicitly NOT decided yet"): milestones do **not** feed
`rankProgress`/`streak`/`personalDevelopmentScore` in this phase — that mapping was never written
into an ADR, so it isn't implemented. Milestones ship as an informational checklist only. The
"should a milestone-based goal ever affect rank" question is deliberately parked, to revisit once
a real PDS milestone-scoring addendum is written.

**`/quests`** — was a dead redirect to `/dashboard` since Slice 4 (see the old `quests/page.tsx`
comment); now the reference's real Quests view: tabs (Active/Completed/Upcoming), a quest list, a
detail pane, and a category-wise progress panel, wrapped in `NavShell` like `/dashboard` and
`/quests/new`. `NavShell`'s "Quests" nav item now points here instead of `/quests/new` (creation is
still reachable via a "New Quest" action inside the view).

**Tab bucketing deliberately avoids inventing a per-goal percentage** — that concept doesn't exist
in this codebase (milestones don't feed the score per the decision above, and there's no per-goal
streak function; ADR-001 avoids per-domain/per-goal progress functions on purpose, and the
reference's own `pctOf` is exactly the kind of hardcoded per-domain math CLAUDE.md flags as
not-a-logic-reference). Bucketing uses only fields with a real existing meaning: `startDate` for
Upcoming, "every milestone complete" for Completed. A goal with no milestones can never land in
Completed — correct for an open-ended daily habit with no finish line, not a gap.

**New Server Actions** (`src/app/quests/actions.ts`): `createMilestone` (append-only `order`, via a
count query — no reordering UI exists yet) and `toggleMilestone`, both following `createQuest`/
`upsertGoalEntry`'s existing conventions exactly (auth check, Zod validation via the already-tested
`createMilestoneSchema`, RLS as the real ownership boundary rather than an app-layer check,
`toUserError` for client-facing messages). No unit tests added for the actions themselves, matching
the precedent `createQuest`/`upsertGoalEntry` already set (Supabase-touching Server Actions are
integration-tested, not unit-mocked, in this codebase) — schema-level validation was already
covered by the existing `milestoneSchema`/`createMilestoneSchema` tests in `goal.test.ts`, part of
the 105/105 already passing before this phase.

**Category-wise progress** only averages milestone completion across goals *that have milestones*
in a category — a category with goals but no milestones shows "No milestones yet" rather than
silently averaging in a 0%, which isn't what "no milestones" means.

**Lint caught 3 raw `<button>`s** (tab switcher, quest-card selector, milestone-row toggle) —
fixed via the same "Button as a flexible interactive primitive, restyled via className" pattern
`form-checkbox.tsx` already established, not a new pattern.

**`npm run smoke` run immediately after the commit that made `/quests` render `NavShell`**, per
the auditer's explicit ask (both prior Criticals were shell/layout changes invisible until this
exact check) — picked up the new route automatically via its filesystem-derived route list, no
manual list update needed, and passed clean. Functional spot-check via a real signed-up user
confirmed the empty state renders (not just a 200).

Full check suite green: `tsc`/`eslint`/`vitest` (105/105, no `src/lib/**` diff — no engine change,
per the milestone-scoring decision)/`build`/`smoke`.

Not yet verified: visual match against the reference's `QuestsView` (panel/tab/card/detail styling),
milestone add/toggle through a real browser session, mobile layout at the `lg:grid-cols-[1.2fr_1fr]`
breakpoint, and a full functional walk (create quest with milestones → toggle some → watch it move
buckets → category progress updates).

---

## Phase 10 (Quests) — VERIFIED, two findings

**Re-checked:** 2026-08-20 · full functional walk, rank-isolation test with control

### The important one: milestones do not touch the rank engine — CONFIRMED

Tested end-to-end through the UI with a real session, not by reading code:

    score baseline                          0-day streak · Overall score 1
    after adding 3 milestones               0-day streak · Overall score 1   unchanged
    after toggling all 3 complete (3/3)     0-day streak · Overall score 1   unchanged

**Control test** (a separate account, proving the engine is not simply frozen — an "unchanged"
result means nothing if nothing can change it):

    completing a DAILY GOAL   before: 0-day streak · Overall score 1
                              after:  1-day streak · Overall score 22   CHANGED

So the isolation is real and specific: daily goal completion moves rank and score, milestone
completion does not. `git diff HEAD -- src/lib/` is empty, confirming no rank-engine change.
This is the claim that mattered most and it holds.

**Tabs / bucketing works.** After completing all milestones the quest moved buckets correctly:
`ACTIVE (1) COMPLETED (0)` → `ACTIVE (0) COMPLETED (1)`, and the summary line followed.
Panel treatment (bracket frames, header bars with icon + dot, letterspaced labels) matches the
rest of the app. Zero console errors throughout.

**Not a defect, checked and cleared:** the milestone input has no `<label>`, but it carries
`aria-label="New milestone title"` and the AX tree resolves the name correctly — so the U24 class
of defect is not present here.

---

## U32 — `/quests` overflows horizontally at every mobile width

**Severity:** Medium · **Status:** OPEN · **Raised:** 2026-08-20 (measured)

`/quests` is the **only** route that overflows, and it worsens as the viewport narrows:

    390px:  /dashboard ok   /quests OVERFLOW +39   /quests/new ok   /setup ok
    360px:  /dashboard ok   /quests OVERFLOW +69   /quests/new ok   /setup ok
    320px:  /dashboard ok   /quests OVERFLOW +109  /quests/new ok   /setup ok

The overflow is a constant: content is pinned at **429px** regardless of viewport, so `<main>`
(`flex flex-1 flex-col pb-16 md:pb-0`) never shrinks below its content's intrinsic width. Classic
flex behaviour — a flex item defaults to `min-width: auto` and will not shrink past its content.
Most likely the quest-list / detail-pane two-column layout not collapsing at mobile; the usual fix
is `min-w-0` on the flex child and a single-column stack below `md`.

Every previous phase was checked for this and passed, so it is new to Phase 10. Worth prioritising
given the owner intends to share a dev link with the client for Quests-flow testing — this is the
screen that link is for, and phones are the likely test device.

---

## U33 — "Category-wise progress" shows a milestone-derived percentage with no visible label

**Severity:** Low-Medium (semantics) · **Status:** OPEN · **Raised:** 2026-08-20

After completing 3/3 milestones on a quest whose daily goal was never completed, the page shows:

    CATEGORY-WISE PROGRESS
    Business · 1                    100%
    (rank card, same screen: 2% → D, 0-day streak, Overall score 1)

Two different progress figures for the same quest on the same screen, with nothing visible
explaining that they measure different things.

The implementation is careful and deliberate — `pct` is `null` unless a category has at least one
goal with milestones (with a comment explaining why), and the Progress element's accessible label
reads `"Business milestone completion, 100%"`, which is exactly right. The gap is that the
**visible** text says only "100%" under a header reading "CATEGORY-WISE PROGRESS". A sighted user
gets the ambiguous version; a screen-reader user gets the precise one.

This is the same conceptual hazard that made the milestone-scoring question worth an ADR in the
first place: the reference derives a quest's percentage from milestones (3/6 = 50%), which is not
ADR-002's model. The owner's decision to keep milestones informational is being honoured in the
engine — the display just doesn't say so. Cheapest fix is wording: "milestone progress" in the
panel header or the row, so the visible label matches the accessible one.

### Minor, noted

- Milestone rows are `<Button>` with an `aria-hidden` visual box and `sr-only` ", complete" /
  ", not complete" text, rather than `role="checkbox"` + `aria-checked`. It is operable and
  announced, but it is inconsistent with `FormCheckbox` used elsewhere in the app, and assistive
  tech will not present it as a checkable item or announce state changes as such. Worth aligning
  when the pattern is next touched.
- `isCompleted` keys only on milestones, so a quest with a *past target date* and no milestones
  stays "Active" indefinitely. The implementing session's reasoning — an open-ended daily habit has
  no finish line — is right for habits, but a dated quest is the case where a user might expect
  otherwise. Not a defect; flagging so the owner can confirm the intended behaviour.

---

## U32 / U33 — fixed

**Status:** fix applied, awaiting auditer re-check · **2026-08-20**

**U32.** `min-w-0` added along the whole containment chain that was pinning `/quests` at 429px:
`NavShell`'s `<main>` (a flex child, defaults to `min-width: auto`, same trap as U32's diagnosis),
the two-column grid itself and both its children (grid items default to `min-width: auto` too --
the other half of the same trap), and the milestone-add `Input` (`flex-1 min-w-0` instead of a bare
width). Every one of these was a candidate floor; fixed the whole chain rather than guessing which
one link actually mattered, since a real browser viewport check is what confirms it, not code
reading.

**U33.** Category panel header changed from "Category-Wise Progress" to "Category Milestone
Progress", and the visible `72%` now reads `72% milestones` inline -- matching the accessible label
("Business milestone completion, 72%") that was already correct. No longer two unlabeled percentage
figures on one screen with nothing visible distinguishing them from the rank card's own progress.

Full check suite green: `tsc`/`eslint`/`vitest` (105/105)/`build`/`smoke`. The mobile-width fix
(U32) needs your real-viewport re-check -- I can't confirm computed layout at 320/360/390px myself,
only that the classes are present in the markup.

Two items acknowledged, not acted on this pass: the milestone-row `<Button>`-not-`role="checkbox"`
inconsistency (minor, flagged for whenever that pattern is next touched, matches the note) and the
past-target-date-with-no-milestones edge case (not a defect, owner confirmation needed, not
blocking).

---

## U32 / U33 — VERIFIED FIXED. Phase 10 CLEAR.

**Re-checked:** 2026-08-20

**U32 fixed.** No horizontal overflow anywhere, at any tested width:

    390px:  dashboard ok  quests ok  quests/new ok  setup ok  welcome ok  login ok
    360px:  dashboard ok  quests ok  quests/new ok  setup ok  welcome ok  login ok
    320px:  dashboard ok  quests ok  quests/new ok  setup ok  welcome ok  login ok

The `min-w-0` chain did not collapse anything: mobile `/quests` stacks to a single column with the
tab row, quest card, category panel, detail pane and milestone form all legible. Swept for
squeezed content (elements under 40px wide carrying more than 12 characters) and the only matches
are the intended 1×1 `sr-only` spans.

Fixing the whole chain rather than bisecting to the single culprit was the right call here — the
`min-width: auto` trap applies to flex *and* grid items alike, so several links were genuinely
candidates, and none of the additions carry a downside.

**The tab row is correct, not clipped.** `UPCOMING (0)` is visually cut at the container edge, but
the row is `overflow-x: auto` and genuinely scrollable (`scrollWidth` 381 vs `clientWidth` 342 at
390px), the tab is reachable and clickable, and the *page* does not overflow. That is the intended
pattern — wide content scrolling inside its own container. Minor, no action: there is no visual
affordance (edge fade or shadow) hinting the strip scrolls, so a user may not discover the third
tab; worth considering if the client's testers report it.

**U33 fixed.** Visible text now reads `CATEGORY MILESTONE PROGRESS … Business · 1 — 33% milestones`,
matching the accessible labels, which were already correct and remain so:

    progressbar: "Business milestone completion, 33%"   aria-valuenow 33
    progressbar: "1 of 3 milestones complete"           aria-valuenow 33

Visible and accessible descriptions now agree, and neither can be mistaken for overall progress.

**Phase 10 is CLEAR.** Quests tabs, detail pane, milestones, and category progress all verified;
milestones confirmed isolated from the rank engine with a control test; no functional regression;
zero console errors.

### Carried forward, agreed as not-this-pass

- Milestone rows use `<Button>` with `sr-only` state text rather than `role="checkbox"` +
  `aria-checked`. Operable and announced, inconsistent with `FormCheckbox`. Align when next touched.
- `isCompleted` keys only on milestones, so a quest with a past target date and no milestones stays
  Active indefinitely. Needs the owner's call, not a defect.

---

## Three owner-requested items — built

**Status:** built, self-verified via smoke, awaiting auditer functional/AX pass · **2026-08-20**

**1. Pre-commit/pre-push gate.** New Husky setup (`.husky/pre-commit`, `.husky/pre-push`,
`prepare: husky` in `package.json` so it auto-installs for anyone who clones and runs `npm
install` -- a raw `.git/hooks/` script wouldn't have, since `.git` isn't tracked). `pre-commit`:
`eslint` + `tsc --noEmit` + `vitest` (fast, no external services, blocks the commit outright on
failure -- not "revert after," the commit is never created). `pre-push`: adds `next build`, then
runs `npm run smoke` if a server is reachable at `SMOKE_BASE_URL` (default `127.0.0.1:3000`),
otherwise **warns loudly and does not block** -- hard-requiring local Supabase + a running server
on every push would fail pushes for reasons unrelated to the code. Manually verified both scripts
directly (not just trusting them to fire correctly on a real commit/push): pre-commit passes clean
on the current tree; pre-push runs build+smoke against a real server and passes; killed the server
and re-ran pre-push to confirm the "unreachable" path warns without blocking (exit 0). This is the
local stopgap CLAUDE.md/CODE_CHECKLIST call for -- real CI (D1/D5) is the unconditional version and
is still separate, unstarted work.

**2. "Missed" tag.** Owner resolved the auditer's exact flagged edge case: a quest is "Missed" only
when it **has milestones**, has a **past target date**, and isn't all-complete
(`quests-view.tsx`'s new `isMissed`). A quest with no milestones never gets tagged Missed regardless
of target date -- it has no completion signal to judge against, so it stays in its normal bucket
("the user might pick it up sometime in future," the owner's own words). Shown as a destructive
`Badge` on both the quest card and the detail pane's Target field.

**3. Milestone checkbox a11y.** Replaced the `<Button>`+`aria-hidden`+`sr-only` pattern with the
real `Checkbox` primitive (Radix, genuine `role="checkbox"`/`aria-checked`) wrapped in a `<label>`
-- the exact pattern `TodayChecklist` already uses for imperative (non-form) toggles, not a new
one. Closes the inconsistency flagged two entries up.

Full check suite green: `tsc`/`eslint`/`vitest` (105/105)/`build`/`smoke` (against a real server,
three routes). Not yet verified: the Missed badge actually appearing for a real past-target-date
milestone quest, and the checkbox's role/aria-checked/announced-toggle behavior via a real AX tree
-- both need the auditer's browser pass, not a self-report.

---

## Three owner-requested items — VERIFIED

**Re-checked:** 2026-08-20

### 1. "Missed" badge — correct on all three cases

Built three quests and checked each against the specified rule
(`isMissed = has milestones && past target date && not all complete`), today being 2026-08-20:

| Quest | Target | Milestones | Rendered |
|---|---|---|---|
| A — overdue, incomplete milestones | 2026-08-10 (past) | 0/2 | **`Missed`** ✅ |
| B — overdue, no milestones | 2026-08-10 (past) | none | no badge ✅ |
| C — future target, incomplete milestones | 2026-12-31 | 0/1 | `Due today`, no badge ✅ |

B is the case the owner specifically ruled on — a dated quest with no milestones is never tagged
Missed, since "the user might pick it up sometime in future". Confirmed: B carries no badge despite
a target date ten days past. The badge appears on both the card and the detail pane as described.

Note, not a defect: a Missed quest stays in the **Active** bucket (`3 active · 0 completed`). That
follows from `isCompleted` keying only on milestones, and is coherent — Missed is informational,
and the quest is still actionable. Flagging only so it is a known consequence rather than a
surprise.

### 2. Milestone checkbox — real checkbox semantics confirmed

Full CDP accessibility tree, before and after toggling:

    before:  [{role:"checkbox", name:"Step one", checked:"false", focusable:true},
              {role:"checkbox", name:"Step two", checked:"false", focusable:true}]
    after:   [{role:"checkbox", name:"Step one", checked:"true",  focusable:true},
              {role:"checkbox", name:"Step two", checked:"false", focusable:true}]

Playwright's independent role engine finds both. Each is named by its milestone title, focusable,
and exposes `checked` state that updates on toggle — so assistive tech now presents these as
checkable items and announces state changes, which the previous `<Button>` + `sr-only` pattern
could not. Keyboard operable: focus + `Space` flips `aria-checked` false → true. The U33-adjacent
inconsistency with `FormCheckbox` is closed.

### 3. Husky hooks — wired correctly, and honest about their limits

`core.hooksPath` is `.husky/_`, shims present for both hooks, both source files executable,
`husky@^9.1.7` installed with a `prepare` script. Branch logic verified by evaluating the same
condition the hook uses:

    server down (127.0.0.1:3000)  → unreachable → WARN, does not block   ✅
    server up   (localhost:3100)  → reachable   → would run smoke        ✅

The split is well-judged: fast checks pre-commit (a doc-only commit should not require Docker),
full suite plus conditional smoke pre-push. The inline comments state plainly that the
warn-don't-block smoke path is a stopgap and that CI is the real gate, which is accurate.

**Standing caveat, not a defect:** `git commit --no-verify` bypasses hooks entirely, and hooks only
protect this machine. This does not reduce **D1 / D5** — a local hook is a convenience, not a gate.
The implementing session said as much to the owner directly, which is the right framing.

**Zero console errors across all of the above.**

---

## Dashboard panel wiring — built, pending verification

**Status:** built, awaiting auditer verification · **2026-08-20**

Owner request, after the previous four phases: `/dashboard` was the one screen left with the old
unpaneled look (only its rank card had `Card brackets`) -- and it's the first thing a client sees
after logging in, before reaching the now-polished Quests flow. `Card brackets` + `PanelHeader`
wired into the rank section ("Hunter Status", icon `Shield`) and the daily checklist ("Today's
Tasks", icon `ListChecks`).

**Deliberately not a rebuild.** The reference's own "Hunter Status" panel carries a much larger
stat set -- best streak, 30-day miss count, days-consistent, a full rank-path visualization. None
of that is added here: those numbers either need multi-domain data this app doesn't have yet, or
new calculations the tested engine doesn't expose (there's no per-metric function for "best streak
ever" or "misses in the last 30 days" today). This is the *existing* content (RankBadge, progress
bar, streak/score text, the daily checklist) moved into the panel system -- not new dashboard
content invented to fill a bigger panel. The "tracked as overall progress" secondary list stays
plain, unpaneled -- matches the reference's own restraint of reserving panels for primary content.

Full check suite green: `tsc`/`eslint`/`vitest` (105/105)/`build`/`smoke`. Functional spot-check via
a real signed-up user confirmed both panel headers render, not just a 200. Not yet verified:
visual match against the reference's panel treatment, and a full functional walk through
`/dashboard` itself (today's checklist toggle, the "finish setup" branch for a pre-setup user).

---

## Dashboard panel wiring — VERIFIED. No findings.

**Re-checked:** 2026-08-20

### Panel treatment matches the reference

    PanelHeader "HUNTER STATUS"   fs=12px ls=2px pad=10px/14px bb=1px icon=true dot=6px
    PanelHeader "TODAY'S TASKS"   fs=12px ls=2px pad=10px/14px bb=1px icon=true dot=6px
    bracket corners: 12 (3 panels x 4)

Identical to the values measured on the five onboarding/auth screens, so the whole app now shares
one panel treatment. `/dashboard` was the last screen on the old unpaneled look.

### Heading structure — correct, U31's lesson applied

    H1:"Dashboard" | H2:"HUNTER STATUS" | H2:"TODAY'S TASKS"

The page's own title stays the `h1`; both panel labels are `h2` chrome beneath it. This is exactly
the structure U31 asked for on `/welcome`, applied here without needing to be told.

### Functional — PASS

- **Checklist toggle works:** `0-day streak · Overall score 1` → `1-day streak · Overall score 22`.
- **Checklist checkbox is properly named:** AX name `"Read 20 books Personal"`, `role=checkbox`,
  `checked` tracks state. The element has no `aria-label` and no own text — the name comes from its
  wrapping `<label>`, which is the correct mechanism.
- **Pre-setup branch renders correctly inside the new panels:**
  `HUNTER STATUS — "Finish setup to start rank tracking."` and
  `TODAY'S TASKS — "Nothing scheduled today. Create a quest to get started."`
  Headings are correct in this state too.
- **No horizontal overflow** at 390 / 360 / 320px.
- **Zero console errors** across every state tested.

### The scope call was right

Not adding the reference's fuller stat set (best streak, 30-day miss count, rank-path
visualisation) was correct. None of that data or calculation exists in the engine, and inventing it
would have been new product content disguised as a styling pass — precisely the "reference is a
UI/UX target, not a logic reference" line CLAUDE.md draws.

### Observation, not a finding

With only two panels, `/dashboard` occupies a narrow column and leaves most of a 1400px viewport
empty — the reference's Command view fills that space with the five panels we deliberately do not
have data for. This is a consequence of the correct scope decision, not a defect, and the fix is
*not* to invent data. If the sparseness matters for the client link, the lever is column width or
panel arrangement, which is a design call for the owner rather than an audit finding.

---

## Three owner-reported bugs — fixed, pending verification

**Status:** built, awaiting auditer verification · **2026-08-20**

Owner pushed the previous commit and reported three real bugs from actually clicking around --
recorded plainly, not filed as audit finding IDs since they came directly from the owner, not from
a review pass.

**1. Glow removed from `Card brackets`.** The Phase 4 pairing of the corner-bracket decoration with
a colored `shadow-[0_0_32px_-8px_var(--primary)]` glow was based on a misreading of the reference:
re-checked its actual CSS (`.panel{...box-shadow:0 0 0 1px rgba(56,207,255,.04) inset,0 18px 50px
-30px rgba(0,0,0,.9)...}`), and the reference's *default* panel shadow is a subtle ambient one, not
a colored glow -- nothing in the reference pairs a colored glow with every bracketed panel. Once
Phase 9.5/10 wired `brackets` onto many more surfaces than Phase 4's original single dashboard rank
card, the same effect that read as a subtle accent on one card stacked into what the owner
correctly called "horrible" across a whole page. Removed the glow line entirely from `card.tsx`;
`brackets` now means corner accents only, closer to the reference's actual restraint.

**2. Empty-state icon.** `/quests`' "No quests yet" empty state gets a large dimmed `Swords` icon
above the text (matching the panel's own header icon), not bare text.

**3. Form field primitives.** Three genuine UX complaints, all in `quests/new/new-quest-form.tsx`:
- **Category** used a native `<input list>` (HTML datalist) -- Chrome renders a dropdown-arrow
  affordance for this that reads as a `<select>` even though it's free text, which is confusing
  (and free text is by design, ADR-001: nothing at the schema level restricts category to the
  suggested values, so a plain `<Select>` would have been the wrong fix). New `ComboboxInput`
  (`src/components/ui/combobox-input.tsx`): a controlled text input with a dropdown-on-focus
  suggestion list, filtered by what's typed, click-to-select -- free text stays possible, the
  confusing native mechanism is gone.
- **Frequency** was a native `<select>`, kept native in the original primitive-swap pass
  specifically to avoid FormData wiring work -- now Radix `Select` (already shadcn-generated,
  previously uncommitted per U11) with a controlled hidden `Input` carrying the real value, the
  same "custom UI control, hidden input submits" pattern `FormCheckbox` already established for
  the daily-tracking checkbox (audit finding U10's fix).
- **Start date / target date** were native `<input type="date">`. New `DatePicker`
  (`src/components/ui/date-picker.tsx`): Popover + shadcn `Calendar` (`react-day-picker`, new
  dependency) behind a styled `Button` trigger, same hidden-input-carries-the-value pattern.
  ISO string <-> `Date` conversion is done in local time, not `new Date(iso)` (which parses as UTC
  and can display the wrong calendar day in timezones behind UTC).

Added via `npx shadcn@latest add select popover calendar` -- confirmed it did NOT overwrite the
already-customized `button.tsx` (declined the prompt), and `select.tsx`/`popover.tsx` are the
components `select.tsx` in particular was dead code for since U11; now actually imported and used.

Full check suite green: `tsc`/`eslint`/`vitest` (105/105)/`build`/`smoke`. **Not verified myself,
and this is the one that most needs it:** I rewired FormData submission mechanics on three fields
of a real Server Action form (`createQuest`) -- lint/types/build can't confirm a real form
submission actually reaches the server with the right values. Please walk the full creation flow
in a real browser: pick a category (both by typing free text and by clicking a suggestion), pick a
frequency, pick both dates via the calendar, submit, and confirm the created quest has the exact
values chosen -- not just that the page renders.

---

## Three owner-reported bugs — VERIFIED FIXED. No findings.

**Re-checked:** 2026-08-20 · form mechanics verified against the database, not the UI

### 3. Rewired form fields — all four values land correctly in Postgres

This was the risky one: three primitives swapped on `createQuest`'s real form, all using the
hidden-input pattern, i.e. exactly the shape that produced U10/U13/U14. Verified by reading the
**`goals` row**, not by trusting the rendered UI.

| Path | Chosen in UI | Stored in DB | |
|---|---|---|---|
| Category — **free text** | `Zzz Bespoke Cat` | `Zzz Bespoke Cat` | ✅ |
| Category — **suggestion click** | `Personal` | `Personal` | ✅ |
| Frequency — Radix Select | `monthly` | `monthly` | ✅ |
| Start date — calendar pick | Aug 5 2026 | `2026-08-05` | ✅ |
| Target date — calendar pick | Aug 25 2026 | `2026-08-25` | ✅ |

Suggestions offered were `Personal, Career, Family, Travel, Business, Relationships`; both the
free-text and click paths write the chosen value. Trigger labels matched their hidden inputs at
submit time (`AUG 5, 2026` ↔ `2026-08-05`), so visible and submitted state agree.

**U10-class regression check — clean.** Submitted with an empty title to force rejection, having
first chosen a category, a non-default frequency and a target date:

    before reject: {category:"RejectCat", frequency:"weekly", startDate:"2026-08-20", targetDate:"2026-08-25", dailyTracking:"on"}
    after  reject: {category:"RejectCat", frequency:"weekly", startDate:"2026-08-20", targetDate:"2026-08-25", dailyTracking:"on"}

Every value preserved, visible triggers still agree with the hidden inputs, form still rendered.
None of the three new primitives reintroduces the silent-reversal failure that took four attempts
to kill on the checkbox.

### 1. Bracket glow removed — confirmed

Bracketed cards now compute to fully transparent shadows
(`rgba(0,0,0,0) 0px 0px 0px 0px …` across the whole stack). The corner accents remain.

The diagnosis behind this fix was right and worth recording: the glow came from a Phase 4 misreading
of the reference, whose default panel shadow is a subtle ambient one, not a coloured glow. It was
invisible as a problem while only the dashboard rank card used `brackets`; Phase 9.5 and 10 put
brackets on many surfaces at once and the effect compounded. A latent wrong decision only becoming
visible at scale — worth remembering as a pattern, not just a fix.

### 2. Empty state — confirmed

`/quests` empty state renders "No quests yet" above a 48px dimmed icon.

**Zero console errors across every path tested.**
