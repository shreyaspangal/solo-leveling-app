-- ADR-002: RankWindow -- one row per user, drives streak/rank/pause state.
-- ADR-003: created at the end of onboarding setup, not at signup, so a user
-- who abandons setup mid-flow has an account but no rank tracking yet.

create table rank_windows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  rank_target text not null check (rank_target in ('D', 'C', 'B', 'A', 'S')),
  window_start date not null,
  grace_used int not null default 0 check (grace_used between 0 and 2),
  paused_from date,
  paused_until date,
  pause_used boolean not null default false,
  constraint pause_dates_together check (
    (paused_from is null) = (paused_until is null)
  ),
  constraint pause_dates_ordered check (
    paused_from is null or paused_until >= paused_from
  ),
  -- One RankWindow per user for Phase 0/1 (a user has a single active climb
  -- at a time). Revisit if rank history needs multiple rows per user later.
  unique (user_id)
);

create index rank_windows_user_id_idx on rank_windows (user_id);

alter table rank_windows enable row level security;

create policy "users manage own rank window"
  on rank_windows for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
