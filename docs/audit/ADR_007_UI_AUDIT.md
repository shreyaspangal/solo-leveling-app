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

**Severity:** Medium · **Status:** OPEN · **Raised:** 2026-08-19

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
