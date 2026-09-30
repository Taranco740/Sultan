-- Read-only MT5 trade history synchronization.
-- Pairing token hashes are kept in a table that client roles cannot access.

create table public.mt5_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  label text not null default 'MetaTrader 5' check (length(trim(label)) > 0),
  broker_server text,
  account_fingerprint text,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (id, user_id),
  foreign key (account_id, user_id)
    references public.trading_accounts(id, user_id) on delete cascade
);

create table public.mt5_connection_secrets (
  connection_id uuid primary key,
  user_id uuid not null,
  token_hash text not null unique check (length(token_hash) = 64),
  created_at timestamptz not null default now(),
  foreign key (connection_id, user_id)
    references public.mt5_connections(id, user_id) on delete cascade
);

create table public.mt5_deals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  connection_id uuid not null,
  ticket numeric(20, 0) not null,
  order_id numeric(20, 0),
  position_id numeric(20, 0),
  time_msc numeric(16, 0) not null,
  deal_type text not null check (deal_type in (
    'buy', 'sell', 'balance', 'credit', 'charge', 'correction',
    'bonus', 'commission', 'commission_daily', 'commission_monthly',
    'interest', 'dividend', 'tax', 'other'
  )),
  entry_type text not null check (entry_type in ('in', 'out', 'inout', 'out_by', 'other')),
  symbol text not null default '',
  volume numeric(20, 8) not null default 0,
  price numeric(20, 10) not null default 0,
  profit numeric(20, 8) not null default 0,
  commission numeric(20, 8) not null default 0,
  swap numeric(20, 8) not null default 0,
  fee numeric(20, 8) not null default 0,
  currency text not null default '',
  updated_at timestamptz not null default now(),
  unique (connection_id, ticket),
  foreign key (connection_id, user_id)
    references public.mt5_connections(id, user_id) on delete cascade,
  foreign key (account_id, user_id)
    references public.trading_accounts(id, user_id) on delete cascade
);

create index mt5_connections_user_account_idx
  on public.mt5_connections (user_id, account_id, created_at desc);
create index mt5_deals_user_account_time_idx
  on public.mt5_deals (user_id, account_id, time_msc desc);
create index mt5_deals_position_idx
  on public.mt5_deals (connection_id, position_id, time_msc);

alter table public.mt5_connections enable row level security;
alter table public.mt5_connection_secrets enable row level security;
alter table public.mt5_deals enable row level security;

create policy "Owners manage their MT5 connections"
  on public.mt5_connections for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owners read their imported MT5 deals"
  on public.mt5_deals for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Owners delete their imported MT5 deals"
  on public.mt5_deals for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.mt5_connection_secrets from anon, authenticated;
revoke all on table public.mt5_deals from anon;
grant select, insert, update, delete on table public.mt5_connections to authenticated;
grant select, delete on table public.mt5_deals to authenticated;
grant all on table public.mt5_connection_secrets, public.mt5_deals to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.mt5_connections, public.mt5_deals;
  end if;
exception when duplicate_object then
  null;
end;
$$;

