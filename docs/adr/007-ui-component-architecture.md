# ADR-007: UI Component Architecture & Visual Theme

**Status:** Proposed
**Context:** CLAUDE.md's original scope decisions committed to a plain interface through Phase 2
("Visual and voice investment is explicitly deferred to Phase 3+, and only once the plain version
has real usage data suggesting it's worth building on") and named the client's reference UX
prototype (`docs/reference/client-ui-prototype.tsx`) as explicitly **not** to be used as an
implementation reference, beyond two named UX patterns. This ADR records a deliberate, explicit
reversal of that scope, made by the project owner on 2026-08-19 — not picked unilaterally, and not
a quiet drift away from the documented decision.

## The problem

The client's actual expectation for the app's look and feel is the reference prototype's dark
"sci-fi System" aesthetic — corner-bracket panels, glow effects, a hex rank badge, sidebar +
bottom-nav shell, Chakra Petch/Rajdhani typography. CLAUDE.md's plain-interface decision was sound
for testing the rank+streak core hypothesis cheaply, but it was never a claim about what the
client ultimately wants shipped — and the project owner has now clarified the client's expectation
directly, ahead of Phase 2.

The scope of the reversal matters: this is **presentation layer only** — component styling,
layout, navigation structure, motion. It does not touch the reference prototype's logic, which
CLAUDE.md correctly continues to flag as unusable: a hardcoded rank formula (not ADR-002's), no
grace/pause handling, per-domain progress functions ADR-001 specifically avoids, in-memory state.
Every Server Component, Server Action, Supabase query, and the ADR-001/002/003 architecture
verified through Phase 1's four-slice review stays exactly as built.

## Decision

Build a theme-agnostic primitive component layer first, then apply the sci-fi visual theme on top
of it — not built themed from the start, so each layer is independently verifiable and the
primitive API isn't coupled to one visual direction.

- **Primitive layer bootstrapped via shadcn/ui's CLI.** Confirmed Tailwind v4-native (official
  CSS-first `@theme` migration path, OKLCH color tokens), semantic CSS-variable token model.
  Adds Radix Primitives, `class-variance-authority`, `clsx`, `tailwind-merge` as dependencies —
  compile-time/lightweight, no runtime UI framework. `lucide-react` added as the icon set (already
  what the reference prototype uses and shadcn's own default — a consistent choice, not a new
  one).
- **Animation: Motion for React (`motion` package, import path `motion/react`)** — but used only
  where CSS genuinely can't do the job, per the `pick-ui-library` skill's own interception rule
  ("Motion pulled in for a plain hover effect or a simple fade" is a smell). Concretely: two
  animated components in v1, decided via the `motion-brief` skill's actual frequency+purpose
  interview rather than animating everything the reference animates —
  - `RankBadge`'s rank-up reveal (E→D→C→B→A→S crossing) — rare, delight-worthy, spring-based
    (`bounce: 0`, crisp/serious per the client's own aesthetic, ~450ms).
  - `NavShell`'s active-route indicator — `layoutId`-based sliding highlight, `ease-in-out`,
    ~180ms.
  - Everything else the reference animates on every page load (progress bar/ring fill, rank badge
    entrance, dashboard card entrance) is **cut**: the dashboard is fully server-rendered with
    real data already resolved before first paint, so animating it "becoming true" on every visit
    (potentially 5–20+ times/day) fabricates a transition that never happened and fails the
    `motion-brief` skill's purpose test. Writing this down is a deliberate result of the process,
    not an oversight.
  - All buttons/cards keep CSS-only hover/press feedback (Tailwind `transition-colors`,
    `active:scale-[0.97]`) — no Motion import needed, keeping most primitives Server Components.
  - `MotionConfig reducedMotion="user"` wraps `{children}` in `src/app/layout.tsx` as an app-wide
    baseline; both animated components additionally branch on `useReducedMotion()` directly, since
    the fade-only default loses meaning for a spring or a `layoutId` move.
- **Theme: dark-only,** matching the reference exactly. Drops the app's current
  OS-preference-only (`prefers-color-scheme`) light/dark toggle — there is no light variant to
  build against, and inventing one has no source of truth.
- **`--radius: 2px`,** a deliberate departure from shadcn's rounded default — central to the
  reference's sharp "HUD" aesthetic, not an oversight of shadcn's defaults.
- **Nav shell: built now, wired to only the routes that exist.** Sidebar (desktop) + bottom nav
  (mobile) match the reference's structure, but list only Home (→ `/dashboard`) and quest creation
  (→ `/quests/new`). Spirituality/Finance/Fitness/Learning are omitted entirely rather than shown
  disabled, matching CLAUDE.md's own Phase 2 domain-rollout sequencing — a disabled nav item
  invites a click and needs a dead-end state designed for no reason.

## Rejected alternatives

- **Hand-roll a smaller primitive set instead of shadcn's CLI.** Considered to avoid adding
  Radix/CVA/clsx/tailwind-merge as dependencies and stay closer to CLAUDE.md's original minimal
  stack list. Rejected: shadcn/ui is real, actively maintained, confirmed Tailwind v4-native
  source we own outright (copied into the repo, not an npm black box), and the added dependencies
  are compile-time/lightweight with no runtime UI-framework overhead.
- **Support both light and dark themes.** Rejected — the reference has no light variant, so
  building one means inventing a "light sci-fi" aesthetic with no client-provided source of truth,
  for a theme the project isn't currently asking to ship anyway.
- **Animate every entrance the reference prototype animates** (progress bar/ring fill, rank badge,
  dashboard cards, all on every page load). Rejected per the `motion-brief` interview: none of
  these clear the frequency+purpose gate on a server-rendered dashboard with no genuine
  loading-to-loaded transition — see Decision above.
- **Framer Motion's `whileTap`/`whileHover` on Button/Card for press/hover feedback.** Rejected
  per `pick-ui-library`: these are simple, interruptible, CSS-transition-native interactions;
  reaching for Motion here would be the "second animation library smell" pattern the skill
  explicitly flags, and it would needlessly push otherwise-static primitives to the client
  boundary.

## Test surface

This is presentation-layer work — no new pure functions with the kind of business-logic test
surface ADR-001/002 require. Verification is via the existing full check suite
(`tsc`/`eslint`/`vitest run`/`next build`) staying green at every build phase, plus a Playwright
browser pass against real local Postgres re-walking the exact flow the auditer verified for Phase
1 Slice 4 (signup → setup → dashboard → create/complete a quest → non-daily goal in the
overall-progress list → `/quests` redirect), confirming zero functional regression. **105/105
rank-engine tests must stay 105/105** — no diff anywhere under `src/lib/**` for the duration of this
work, **except** `src/lib/utils.ts` (shadcn's CLI-generated `cn()` helper) and `src/lib/motion.ts`
(the plan's own named Motion for React presets module — deliberately not placed under
`src/components/ui/`, which is shadcn's generated-output directory). Any other diff under
`src/lib/**` — including `today.ts`, `schemas/`, `supabase/`, `rate-limit.ts`, not just the rank
engine — means scope crept beyond this ADR.

## Explicitly out of scope

- The reference prototype's logic — rank formula, grace/pause handling, per-domain progress
  functions, in-memory state. CLAUDE.md's caution against using the prototype as an
  implementation reference stands for everything except the UI/UX layer this ADR covers.
- Toasts — the reference has one, current MVP doesn't need it. If added later, `Sonner` is the
  validated choice per `pick-ui-library`, not a hand-rolled implementation.
- Building nav entries or any UI for Spirituality/Finance/Fitness/Learning — those domains don't
  exist yet; CLAUDE.md's Phase 2 sequencing still governs when they get built.
