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
