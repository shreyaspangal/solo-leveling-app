# ADR-001: Unified Goal Entity

**Status:** Proposed
**Context:** Solo Leveling personal development app — Phase 1 build

## Decision

A single `Goal` entity powers Quests, Spirituality, and Learning. Finance and Fitness are explicitly out of scope for this entity — they get their own models later (ADR-004/005), because they have real mechanical needs (monetary math, nutrition calc) this entity isn't built for.

## Schema

```
Goal {
  id: uuid
  user_id: uuid                    // owner, for multi-user isolation
  domain: "quest" | "spirituality" | "learning"
  title: string
  description: string | null
  category: string                 // free text; onboarding templates seed suggested values per domain
  frequency: "daily" | "weekly" | "monthly" | "custom"
  daily_tracking: boolean          // if false, goal is tracked as overall % only, no per-day checklist
  start_date: date
  target_date: date | null         // null = ongoing, no end
  created_at: timestamp
  updated_at: timestamp
}

GoalEntry {
  id: uuid
  goal_id: uuid
  date: date                       // the day this entry represents
  completed: boolean
  created_at: timestamp
}

Milestone {
  id: uuid
  goal_id: uuid
  title: string
  completed: boolean
  order: int
}
```

**Why entries are a separate table, not a boolean map on the goal:** completion needs to be queryable ("show me every incomplete day in this rank window"), and Postgres does that naturally as rows, not as a blob deserialized and scanned in JS.

**Why milestones are separate from entries:** milestones are one-time checkpoints, not daily recurring completions. A goal is either milestone-based (progress = milestones completed / total) or entry-based (progress = entries completed / entries expected), never both — decided by `milestones.length > 0`. This avoids the "three different progress functions with different meanings" problem seen in an early UX prototype of this app.

## Domain differentiation is onboarding-only, not schema-only

`domain` exists on the entity for filtering/display (which module a goal shows up in), but it does **not** change validation, storage, or calculation logic. What actually differs per domain is the **onboarding template**:

| Domain | Suggested categories (seed data, user can override) | Default frequency |
|---|---|---|
| Quests | Personal, Career, Family, Travel, Business, Habits, Other | Daily |
| Spirituality | Scripture, Prayer, Meditation, Gratitude, Worship, Mindfulness | Daily |
| Learning | Skills, Study, Design, Technology, Languages, Career | Daily, with `daily_tracking` toggle exposed prominently (per PRD's "Daily Tracking: Yes/No") |

This is the concrete mechanism for "collapse into the same engine, different onboarding templates" — one `goals` table, one Zod schema, one streak function, three different pre-filled forms.

## Rank/streak/pause fields (computed, not stored redundantly)

Streak, grace-period state, and pause windows are **derived from `GoalEntry` rows plus a separate `RankWindow` record per user** (see ADR-002), not stored as counters on `Goal`. Storing a running streak counter invites drift bugs — it should always be recomputable from raw entries, so the streak stays honest even if a bug touches it once.

```
RankWindow {
  id: uuid
  user_id: uuid
  rank_target: "D" | "C" | "B" | "A" | "S"
  window_start: date
  grace_used: int        // 0, 1, or 2 — caps at 2 per grace-period rule
  paused_from: date | null
  paused_until: date | null
  pause_used: boolean    // caps at 1 per window, max 7 days — enforced at write time
}
```

## Explicitly out of scope for this ADR

- Finance entity (loans, expenses, monetary goals) — separate ADR (004)
- Fitness entity (meals, workouts, measurements) — separate ADR (005)
- The rank/streak/pause **calculation logic itself** — that's ADR-002

## Consequences

- Adding a 4th generic domain later costs one onboarding template, zero schema changes.
- Query for "everything a user needs to log today" is one `GoalEntry` query across all three domains, not three separate lookups — this is what makes a future unified quick-log agent (Phase 3) cheap to build against.
- Trade-off: category is free text, not an enum, so there's no database-level guarantee a Fitness-style structured category system couldn't accidentally get typed in here. Zod validation at the API boundary is the actual guard, not the schema.
