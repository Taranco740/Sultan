create table public.trading_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.strategy_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  strategy_id uuid not null,
  label text not null check (length(trim(label)) > 0),
  position integer not null default 0 check (position >= 0),
  required boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (strategy_id, user_id)
    references public.trading_strategies(id, user_id) on delete cascade
);

create table public.life_area_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  area text not null check (area in ('health', 'trading', 'wealth', 'mind')),
  score smallint not null check (score between 1 and 10),
  day date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, area, day)
);

create index trading_strategies_user_active_idx
  on public.trading_strategies (user_id, is_active, created_at desc);
create index strategy_checklist_items_user_strategy_idx
  on public.strategy_checklist_items (user_id, strategy_id, position);
create index life_area_scores_user_day_idx
  on public.life_area_scores (user_id, day desc, area);

alter table public.trading_strategies enable row level security;
alter table public.strategy_checklist_items enable row level security;
alter table public.life_area_scores enable row level security;

create policy "Owners manage their trading strategies"
  on public.trading_strategies for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owners manage their strategy checklist items"
  on public.strategy_checklist_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owners manage their life area scores"
  on public.life_area_scores for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on table
  public.trading_strategies,
  public.strategy_checklist_items,
  public.life_area_scores
to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.trading_strategies,
      public.strategy_checklist_items,
      public.life_area_scores;
  end if;
exception when duplicate_object then
  null;
end;
$$;

