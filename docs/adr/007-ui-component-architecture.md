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
- **Nav shell: the reference's full 6-item structure — left rail (desktop) / bottom bar (mobile),
  Command/Spirituality/Finance/Fitness/Learning/Quests, with a persistent rank card in the rail.**
  *(2026-08-20: this bullet originally specified a single responsive 3-item row instead, on the
  reasoning that a 3-item nav didn't need the reference's split. Superseded, not retroactively
  wrong for what it evaluated — the project owner's 2026-08-20 scope amendment changed the item
  count the reasoning was applied to, and a standing instruction that followed it ("this should be
  based on the reference ui... unless it's broken or not suitable per UI/UX best practices") means
  the reference is the default going forward, not a judgment call re-litigated per component. Kept
  here rather than deleted so the reversal itself stays on the record — this doc is a build log,
  not a snapshot.)* Spirituality/Finance/Fitness/Learning render as disabled "coming soon" tiles —
  ADR-007's original objection to that pattern ("invites a click and needs a dead-end state
  designed for no reason") is itself superseded by the same owner instruction: a disabled
  coming-soon tile is a standard, well-understood pattern, not a dead end. One deliberate deviation
  from the reference under the "unless not suitable" clause: nav-item touch targets are `min-h-11`
  (44px), not the reference's ~35px — WCAG 2.2 SC 2.5.8 and platform mobile-tap guidance (U19)
  outrank pixel-matching the prototype. Sign-out moved off the primary nav into a thin top header
  (reachable at every breakpoint) rather than the reference's topbar avatar-dropdown menu — that
  menu needs a new dropdown-menu primitive and a displayable user name, neither of which exist yet;
  building it is real scope beyond "nav rebuild," not a same-size substitution, so it's deferred
  rather than approximated.

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
engine — means scope crept beyond this ADR. *(2026-08-20: one further named exception,
`src/lib/domains.ts`, added below in the amendment's "U23 / domains.ts guardrail exception"
note — added there rather than rewritten in here so this original list stays an accurate record
of what the ADR said at the time, not silently edited to look like it always included it.)*

## Amendment (2026-08-20) — nav reversal + expanded scope

The audit's Phase 7 QA sweep (U22–U27) found that the gap between our build and the reference
isn't missing screens — it's a missing visual system. The reference's panel kit (bracketed
frames, header bars with icon+pulse-dot+uppercase label, uppercase micro-labels, outline buttons)
appears on exactly one surface in our build (the dashboard rank card via `Card brackets`);
everywhere else is unframed, and our buttons are a *solid filled pill*, the visual opposite of
the reference's *bordered transparent* primary action. The project owner confirmed this reading
directly (2026-08-20) and made four scope calls, each superseding a prior decision on its own
narrow point — the same "explicit change from the project owner" mechanism that opened this ADR
in the first place:

1. **Nav (reverses U20).** Build the reference's structure — left rail (desktop) / bottom bar
   (mobile), all 6 items — not the single responsive row U20 committed to. U20's reasoning (3
   items don't need the split) is superseded, not wrong for what it evaluated; the row was correct
   for a 3-item nav, and this amendment changes the item count, not the row's math. Sign-out moves
   off the primary nav (the reference has no sign-out item in its 6) into a small corner
   affordance — exact placement decided during Phase 9 build, not prescribed here.
2. **Spirituality/Learning: coming-soon disabled tiles**, not omitted (contra ADR-007's original
   nav bullet) and not built real (contra pulling Phase 2 forward). This also resolves U23:
   `domains.ts`'s `available: true` for these two was always wrong for what a user can actually do
   today (no route creates either) — Phase 11 sets both to `false`, so `/setup` and the nav agree.
3. **Quests feature build** — tabs (Active/Completed/Upcoming), detail pane, category progress,
   and the milestone checklist, all in this workstream. Tabs/detail/category-progress use data the
   app already fetches; milestones need new UI against the table `00000000000001_goal_entity.sql`
   already created and `goal.ts`'s already-existing `milestoneSchema` — no new ADR, no new
   migration, this was simply never built.
4. **Bundle U22/U23/U24** (setup screen's unanswerable question, the `domains.ts` availability
   mismatch just described, and the login/signup accessible-name gap) into this workstream rather
   than a separate pass — small, isolated, no scope overlap with the visual/nav work.

### Phase plan (8–11)

- **Phase 8 — visual primitives.** `PanelHeader` (icon + pulse dot + uppercase letterspaced label
  + rule, matches reference `.phead`), a micro-label pattern for form/stat labels (reference
  `.lbl`), restyled `Button` variants (`default` becomes the bordered-transparent "sysbtn" look;
  a new `ghost`-adjacent ADR-007 style for the reference's `.sysbtn.ghost`), grid-texture +
  vignette background at the root layout. Primitives only — this phase does not touch page
  content structure, so it's independently reviewable before every screen changes under it.
- **Phase 9 — nav rebuild.** Left rail + bottom bar, 6 items (Home/Quests active; Spirituality/
  Finance/Fitness/Learning coming-soon disabled), sign-out relocated, applied across all existing
  pages. Supersedes U20's row.
- **Phase 10 — Quests feature build.** Tabs, detail pane, category progress (existing data), and
  milestone checklist (new Server Action + query against the existing table/schema).
- **Phase 11 — bug fixes.** U22 (setup copy), U23 (`domains.ts` availability), U24 (auth input
  accessible names).

Test surface, guardrails, and the "no diff under `src/lib/**` except `utils.ts`/`motion.ts`" rule
from the original Test Surface section continue to apply, with one addition: Phase 10's milestone
Server Action is new business logic, not presentation, so it gets its own unit tests (schema
validation, ordering) same as any other Server Action in this codebase — the blanket `src/lib/**`
freeze was about not touching the *rank/streak/pause engine* while doing paint, not a ban on all
new logic for the rest of the workstream's life.

### U23 / `domains.ts` guardrail exception (2026-08-20)

U23's fix (`available: true` → `false` for Spirituality/Learning, matching the nav's coming-soon
treatment) landed as a two-boolean-flip diff to `src/lib/domains.ts`, which the Test Surface
section above does not name alongside `utils.ts`/`motion.ts` — flagged by the auditer as a real
guardrail breach on the letter of the rule, not a grey area, and correctly so: the rule names
`domains.ts` sits under (`schemas/`, `supabase/`, `today.ts`, `rate-limit.ts`) explicitly, by name,
as *not* exempt, and a rule that gets silently adjusted whenever a change seems obviously safe
stops being a bright line the next session can trust at face value. Recorded here as a deliberate,
disclosed third exception rather than left undocumented: `domains.ts` is display-only onboarding
config, carries no test file, and sits nowhere near `rank-engine/` — the guardrail's actual purpose
(protect the 105/105 rank/streak/pause suite from paint-phase collateral damage) isn't implicated
by it. Scoped narrowly to this one file, this one change — not a general "obviously-safe changes
are fine" precedent for the rest of the workstream.

## Explicitly out of scope

- The reference prototype's logic — rank formula, grace/pause handling, per-domain progress
  functions, in-memory state. CLAUDE.md's caution against using the prototype as an
  implementation reference stands for everything except the UI/UX layer this ADR covers.
- Toasts — the reference has one, current MVP doesn't need it. If added later, `Sonner` is the
  validated choice per `pick-ui-library`, not a hand-rolled implementation.
- **Building real functionality for Spirituality/Finance/Fitness/Learning** — those domains don't
  exist yet; CLAUDE.md's Phase 2 sequencing still governs when they get built. Superseded on one
  narrow point by the 2026-08-20 amendment above: disabled coming-soon *nav tiles* for
  Spirituality/Finance/Fitness/Learning are now in scope (Phase 9) as a visual/labeling change,
  not a functionality one — no route, query, or Server Action backs any of the four.
