-- ADR-001: unified Goal entity for Quests, Spirituality, Learning.
-- Finance and Fitness are explicitly out of scope (ADR-004/005, not yet written).

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain text not null check (domain in ('quest', 'spirituality', 'learning')),
  title text not null,
  description text,
  category text not null, -- free text by design; Zod is the real guard, see ADR-001
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly', 'custom')),
  daily_tracking boolean not null default true,
  start_date date not null,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint target_date_after_start check (target_date is null or target_date >= start_date)
);

create index goals_user_id_idx on goals (user_id);

create table goal_entries (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals (id) on delete cascade,
  date date not null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (goal_id, date)
);

create index goal_entries_goal_id_date_idx on goal_entries (goal_id, date);

create table milestones (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals (id) on delete cascade,
  title text not null,
  completed boolean not null default false,
  "order" int not null default 0
);

create index milestones_goal_id_idx on milestones (goal_id);

-- updated_at maintenance
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger goals_set_updated_at
  before update on goals
  for each row
  execute function set_updated_at();

-- ADR-003: RLS, applied uniformly to every table.
alter table goals enable row level security;
alter table goal_entries enable row level security;
alter table milestones enable row level security;

create policy "users manage own goals"
  on goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users manage own goal entries"
  on goal_entries for all
  using (goal_id in (select id from goals where user_id = auth.uid()))
  with check (goal_id in (select id from goals where user_id = auth.uid()));

create policy "users manage own milestones"
  on milestones for all
  using (goal_id in (select id from goals where user_id = auth.uid()))
  with check (goal_id in (select id from goals where user_id = auth.uid()));
