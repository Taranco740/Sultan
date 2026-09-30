create table public.trading_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null,
  trading_day date not null default current_date,
  symbol text not null check (length(trim(symbol)) > 0),
  side text not null check (side in ('buy', 'sell')),
  setup text not null check (length(trim(setup)) > 0),
  reason text not null check (length(trim(reason)) > 0),
  emotion text not null check (length(trim(emotion)) > 0),
  lesson text not null check (length(trim(lesson)) > 0),
  followed_plan boolean not null default false,
  outcome text check (outcome is null or outcome in ('win', 'loss', 'breakeven', 'pending')),
  created_at timestamptz not null default now(),
  foreign key (account_id, user_id)
    references public.trading_accounts(id, user_id) on delete cascade
);

create index trading_journal_user_account_day_idx
  on public.trading_journal_entries (user_id, account_id, trading_day desc, created_at desc);

alter table public.trading_journal_entries enable row level security;

create policy "Owners manage their trading journal entries"
  on public.trading_journal_entries for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on table public.trading_journal_entries to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.trading_journal_entries;
  end if;
exception when duplicate_object then
  null;
end;
$$;

