# ADR-003: Auth & Multi-User Data Isolation

**Status:** Proposed
**Context:** Every table from ADR-001 and ADR-002 (`Goal`, `GoalEntry`, `Milestone`, `RankWindow`) needs to belong to exactly one user, and one user must never be able to read or write another's data — enforced at the database, not just in app code, since an AI coding agent writing queries is a realistic source of an accidentally-missing `WHERE user_id = ...` clause.

## Decision

**Supabase Auth** handles identity (email/password, Google, Apple — per the PRD's sign-up options). **Postgres Row Level Security (RLS)** handles isolation, on every table, as the actual enforcement boundary — not a convention the app layer has to remember.

## Identity

```
auth.users                          // Supabase-managed, not touched directly
  id: uuid (this IS the user_id used everywhere else)
  email
  raw_app_meta_data: { provider: "email" | "google" | "apple" }
```

No separate `profiles`/`users` table duplicating what Supabase Auth already stores for Phase 0 — a `UserProfile` table gets added only if/when the app needs fields Auth doesn't carry (display name customization, avatar, etc.).

## Row-level security, applied uniformly

Every table with a `user_id` column gets the same policy shape:

```sql
alter table goals enable row level security;

create policy "users manage own goals"
  on goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Applied identically to `goals`, `goal_entries`, `milestones`, `rank_windows`, and every table ADR-004/005 will add for Finance/Fitness. `goal_entries` and `milestones` don't carry `user_id` directly (they hang off `goal_id`) — their policy joins through the parent:

```sql
create policy "users manage own goal entries"
  on goal_entries for all
  using (goal_id in (select id from goals where user_id = auth.uid()));
```

**Why RLS and not just app-layer checks:** the app-layer version is "remember to filter by user_id in every query" — one missed filter in one Claude Code–generated query is a cross-user data leak. RLS makes the database itself refuse the row regardless of what the query says.

## Session handling

- Supabase's client SDK manages JWT issuance/refresh in the browser.
- Server-side reads (Next.js server actions, route handlers) use Supabase's server client, which forwards the user's JWT so RLS policies apply identically whether the request came from the browser or the server — no separate "trusted server" bypass path.

## Onboarding tie-in

Account creation → first-time setup (domain selection, per the PRD flow) → this ADR's boundary is: **account creation and domain selection are separate steps, but the first `RankWindow` row is created at the end of setup, not at signup.** A user who signs up and abandons setup has an account but no rank tracking yet — avoids a `RankWindow` existing with a null or placeholder target.

## Explicitly out of scope

- Password reset / email verification flows — standard Supabase Auth behavior, not a structural decision worth an ADR
- Team/family sharing of data (explicitly deferred per the PRD's "no sharing in v1") — if it ever comes up, it's a new ADR, not a retrofit of this one

## Test surface

- RLS: user A cannot `select`/`update`/`delete` user B's goals, entries, or rank window, even with a directly-crafted query — test against the real database, not mocked
- Onboarding: `RankWindow` doesn't exist until setup completes; a mid-setup abandon leaves no orphaned rank data
- Auth provider linking: a user who signs up via email and later logs in via Google with the same email address — confirm this doesn't silently create a second account (Supabase handles this via email as the linking key, but worth an explicit test given it's a PRD requirement: "log in using Google or Apple without creating a separate account")
