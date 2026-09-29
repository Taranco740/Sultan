create extension if not exists "pgcrypto";

create type public.life_area as enum ('health', 'trading', 'wealth', 'career', 'mind', 'learning');
create type public.focus_area as enum ('personal', 'trading', 'health', 'work');
create type public.workout_mode as enum ('full', 'easy', 'skip');
create type public.checklist_kind as enum ('pre_trade', 'morning', 'evening', 'custom');
create type public.journal_kind as enum ('personal', 'trading', 'reflection', 'gratitude');
create type public.money_kind as enum ('income', 'expense', 'saving', 'passive');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  display_name text,
  timezone text not null default 'Africa/Nairobi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  area public.life_area not null,
  title text not null check (length(trim(title)) > 0),
  why text,
  stage text,
  target_date date,
  status text not null default 'active' check (status in ('active', 'paused', 'complete', 'archived')),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.goal_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null,
  title text not null check (length(trim(title)) > 0),
  done boolean not null default false,
  done_at timestamptz,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (goal_id, user_id, id),
  foreign key (goal_id, user_id) references public.goals(id, user_id) on delete cascade
);

create table public.focus_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null default current_date,
  title text not null check (length(trim(title)) > 0),
  area public.focus_area not null default 'personal',
  goal_id uuid,
  remind_at time,
  done boolean not null default false,
  minimum boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (goal_id, user_id) references public.goals(id, user_id) on delete set null (goal_id)
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null default current_date,
  muscle_group text,
  mode public.workout_mode,
  notes text,
  duration_min integer check (duration_min is null or duration_min >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_id uuid not null,
  exercise text not null,
  set_no integer not null check (set_no > 0),
  reps integer check (reps is null or reps >= 0),
  weight_kg numeric(8, 2) check (weight_kg is null or weight_kg >= 0),
  foreign key (workout_id, user_id) references public.workouts(id, user_id) on delete cascade
);

create table public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null default current_date,
  kind text,
  distance_km numeric(8, 3) check (distance_km is null or distance_km >= 0),
  duration_s integer check (duration_s is null or duration_s >= 0),
  route jsonb,
  created_at timestamptz not null default now()
);

create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null default current_date,
  duration_min integer check (duration_min is null or duration_min between 0 and 1440),
  quality integer check (quality is null or quality between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, day)
);

create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind public.checklist_kind not null,
  title text not null,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  checklist_id uuid not null,
  label text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (checklist_id, user_id) references public.checklists(id, user_id) on delete cascade
);

create table public.checklist_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null,
  day date not null default current_date,
  done boolean not null default false,
  unique (item_id, day),
  foreign key (item_id, user_id) references public.checklist_items(id, user_id) on delete cascade
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mt5_ticket bigint,
  symbol text,
  side text check (side is null or side in ('buy', 'sell')),
  lots numeric(12, 4) check (lots is null or lots >= 0),
  open_time timestamptz,
  close_time timestamptz,
  open_price numeric(18, 8),
  close_price numeric(18, 8),
  profit numeric(16, 2),
  setup text,
  reason text,
  emotion text,
  lesson text,
  followed_plan boolean,
  created_at timestamptz not null default now(),
  unique (user_id, mt5_ticket)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind public.journal_kind not null,
  body text not null,
  mood integer check (mood is null or mood between 1 and 5),
  created_at timestamptz not null default now()
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null,
  area public.life_area,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  client text,
  title text not null,
  goals text,
  plan text,
  status text not null default 'active' check (status in ('active', 'paused', 'complete', 'archived')),
  due date,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null,
  title text not null,
  done boolean not null default false,
  due date,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (project_id, user_id) references public.projects(id, user_id) on delete cascade
);

create table public.money_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null default current_date,
  kind public.money_kind not null,
  amount numeric(14, 2) not null check (amount >= 0),
  category text,
  note text,
  created_at timestamptz not null default now()
);

create table public.learning_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  area public.life_area,
  title text not null,
  kind text,
  progress integer not null default 0 check (progress between 0 and 100),
  notes text,
  updated_at timestamptz not null default now()
);

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  note text,
  next_contact date,
  created_at timestamptz not null default now()
);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null,
  area_scores jsonb not null default '{}'::jsonb,
  summary text,
  next_week_focus text,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index focus_items_user_day_idx on public.focus_items (user_id, day, created_at);
create index goals_user_area_status_idx on public.goals (user_id, area, status);
create index journal_entries_user_created_idx on public.journal_entries (user_id, created_at desc);
create index money_entries_user_day_idx on public.money_entries (user_id, day desc);
create index trades_user_closed_idx on public.trades (user_id, close_time desc);
create index project_tasks_user_project_idx on public.project_tasks (user_id, project_id, done);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'goals', 'goal_steps', 'focus_items', 'workouts', 'workout_sets',
    'runs', 'sleep_logs', 'checklists', 'checklist_items', 'checklist_runs',
    'trades', 'journal_entries', 'ideas', 'projects', 'project_tasks',
    'money_entries', 'learning_items', 'relationships', 'weekly_reviews'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy "Sultan owners only" on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name
    );
  end loop;
end;
$$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
