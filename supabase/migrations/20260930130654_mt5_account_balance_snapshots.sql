-- Store the latest read-only account snapshot reported by the MT5 terminal.
-- Existing mt5_connections RLS remains in force; snapshots are scoped to that row/user.
alter table public.mt5_connections
  add column latest_balance numeric(20, 8),
  add column latest_equity numeric(20, 8),
  add column currency text;
