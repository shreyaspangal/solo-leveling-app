# CLAUDE.md — Solo Leveling: Individual Development System

This file orients Claude Code sessions. It does not restate the full spec — it points to the
documents that are actually authoritative, and captures the scope/sequencing decisions that
sit *between* the PRD and the ADRs, which aren't written down anywhere else.

## Source of truth, in order

1. **`Solo_Leveling_PRD.pdf`** (or its extracted text, kept in `docs/prd.md`) — the full product
   spec. This is the ground truth for *what the product should eventually do*. If this CLAUDE.md
   or any ADR conflicts with the PRD on a feature's existence or behavior, the PRD wins — flag
   the conflict rather than silently resolving it.
2. **`docs/adr/*.md`** — structural/architectural decisions that implement the PRD. These are
   authoritative for *how* things are built (data model, calculation logic, auth boundary).
   Read every ADR before touching related code. Currently:
   - `001-goal-entity.md` — unified Goal/GoalEntry/Milestone model for Quests, Spirituality, Learning
   - `002-rank-streak-pause.md` — the rank/streak/pause calculation engine
   - `003-auth-isolation.md` — Supabase Auth + RLS multi-user boundary
3. **This file** — sequencing and scope decisions that came out of planning discussion, not yet
   promoted to ADRs. Treat these as binding until superseded by a new ADR or an explicit change
   from the project owner.

**Important:** the PRD describes the full desired end state with no build-order attached — it
lists every feature with no cost. This file and the ADRs exist specifically to sequence and
scope that down. Do not treat "the PRD mentions X" as license to build X now if it contradicts
the phase plan below.

## Core hypothesis this build is testing

Rank + streak, on a **plain interface**, is what drives daily consistency — not voice input,
not visual novelty, not having all five domains available at once. Every sequencing decision
below exists to test that cheaply before investing in anything else.

## Scope decisions (binding until changed)

- **Engine is collapsed, not five separate systems.** Quests, Spirituality, and Learning share
  one `Goal` entity (ADR-001) and differ only by onboarding template (seed categories, default
  frequency). Do not build domain-specific tracking logic for these three — if a feature request
  seems to need that, stop and flag it rather than diverging the schema.
- **Finance and Fitness stay structurally separate**, deferred to Phase 2. They have real
  mechanical requirements (loan/₹ math, ingredient-level nutrition calc) the generic engine
  can't absorb. Not a priority cut — a genuine architectural difference.
- **Interface stays plain through Phase 2.** No voice input, no bespoke visual identity/theme,
  no elaborate motion/animation layer. Clean, functional, responsive (mobile + desktop). Visual
  and voice investment is explicitly deferred to Phase 3+, and only once the plain version has
  real usage data suggesting it's worth building on.
- **Multi-user from day 1** (not a single-user personal tool) — per ADR-003, every table is
  RLS-scoped to `auth.uid()` from the start.
- **A reference UX prototype exists** (a heavily-themed single-file React demo covering all 5
  domains) but should **not** be used as an implementation reference. It predates the ADRs, uses
  a hardcoded rank formula (not ADR-002's), has no grace/pause logic, uses per-domain progress
  functions that ADR-001 specifically avoids, and invests in visual novelty this project
  explicitly sequenced for later. Useful only for: the global date-filter interaction pattern,
  and the ingredient-based meal macro calculator UX.

## Build order

**Phase 0 — Foundation** *(current phase)*
Auth (ADR-003), unified Goal entity (ADR-001), rank/streak/pause engine (ADR-002), onboarding
flow (Welcome → Rules → Signup → domain selection, per PRD). Not tester-facing.

**Phase 1 — Quests pilot**
Full vertical slice on one domain (Quests) end-to-end: create → track → streak → rank
contribution. Home Dashboard v1. Proves the core loop before replicating to other domains.

**Phase 2 — Remaining domains, cheapest to most expensive**
Spirituality → Learning (both near-identical Quest variants) → Finance → Fitness (last: only
domain needing an external API, file uploads, and an exercise library).
→ **Earliest sensible point to open beta access** — a tester seeing only Quests judges the
whole 5-domain pitch on a fifth of it.

**Phase 3 — Cross-cutting**
Global date filter + historical view (deliberately sequenced after all domains exist, since it
depends on a consistent completion model across all of them — see PRD's "Global Date Filter &
Historical View" section). AI quick-log agent: natural language → domain classification →
schema-validated staging → user-confirmed write (never let model output touch the DB directly).
Voice input starts here as "say a sentence instead of typing," not an ongoing conversation.

**Phase 4 — Later**
Coaching/insight AI agent (needs real historical data to not be generic filler). Achievements,
reminders, progress-photo comparison view. Ongoing spoken conversation mode for the agent
(only once Phase 3's simpler voice input is validated).

## Stack

Node.js 24 LTS · Next.js 16 · TypeScript 5.x · Tailwind CSS v4 · Supabase (Postgres, Auth,
Storage) · Zod · Vercel AI SDK · Claude API. Nutrition lookups: USDA FoodData Central (free)
over a paid API, unless ingredient coverage proves insufficient.

*(Verify these are still current LTS/stable before scaffolding — versions drift; this list was
accurate as of the planning conversation, not guaranteed current at build time.)*

## TDD workflow

- Every structural decision gets an ADR before implementation — not optional for this project,
  since it's how sessions stay consistent with each other instead of re-deriving the design.
- Per vertical slice: write failing tests first (Zod schema validation, streak-calc, rank-window
  logic per ADR-002's test surface) → implement to green → refactor.
- The quick-log AI agent (Phase 3) needs a golden-fixture test suite (fixed natural-language
  inputs → expected structured output) in addition to normal unit tests, since LLM output needs
  regression protection unit tests don't provide.
- Review and pressure-test agent-written code before merging — don't accept on trust, especially
  around rank/streak logic where a silent bug misrepresents a user's real progress.

## What's explicitly NOT decided yet

- Exact rank-window promotion behavior (notification, history record) when a `RankWindow`
  completes — likely folds into ADR-002 implementation.
- Finance and Fitness entity schemas — ADR-004 and ADR-005, not yet written. Do not improvise
  these structurally; flag for an ADR pass when Phase 2 starts.
- Historical query design for the global date filter — flagged for its own ADR at the start of
  Phase 3, not before, since it should be designed once against all five domains, not guessed
  early against three.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
