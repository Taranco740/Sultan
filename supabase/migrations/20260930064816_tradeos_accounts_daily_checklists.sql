create table public.trading_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text not null check (length(trim(label)) > 0),
  broker_name text,
  mode text not null default 'demo' check (mode in ('demo', 'live', 'paper')),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.trading_checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null,
  title text not null check (length(trim(title)) > 0),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (account_id, user_id)
    references public.trading_accounts(id, user_id) on delete cascade
);

create table public.trading_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  checklist_id uuid not null,
  label text not null check (length(trim(label)) > 0),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (checklist_id, user_id)
    references public.trading_checklists(id, user_id) on delete cascade
);

create table public.trading_checklist_checks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null,
  trading_day date not null default current_date,
  checked boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (item_id, trading_day),
  foreign key (item_id, user_id)
    references public.trading_checklist_items(id, user_id) on delete cascade
);

create index trading_accounts_user_created_idx
  on public.trading_accounts (user_id, created_at);
create index trading_checklists_user_account_idx
  on public.trading_checklists (user_id, account_id, created_at);
create index trading_checklist_items_user_list_idx
  on public.trading_checklist_items (user_id, checklist_id, position);
create index trading_checklist_checks_user_day_idx
  on public.trading_checklist_checks (user_id, trading_day desc);

alter table public.trading_accounts enable row level security;
alter table public.trading_checklists enable row level security;
alter table public.trading_checklist_items enable row level security;
alter table public.trading_checklist_checks enable row level security;

create policy "Owners manage their trading accounts"
  on public.trading_accounts for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owners manage their trading checklists"
  on public.trading_checklists for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owners manage their trading checklist items"
  on public.trading_checklist_items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owners manage their daily checklist checks"
  on public.trading_checklist_checks for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on table
  public.trading_accounts,
  public.trading_checklists,
  public.trading_checklist_items,
  public.trading_checklist_checks
to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.trading_accounts,
      public.trading_checklists,
      public.trading_checklist_items,
      public.trading_checklist_checks;
  end if;
exception when duplicate_object then
  null;
end;
$$;

