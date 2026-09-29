create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null default current_date,
  amount_ml integer not null check (amount_ml > 0),
  created_at timestamptz not null default now()
);

create index water_logs_user_day_idx on public.water_logs (user_id, day desc);
alter table public.water_logs enable row level security;
create policy "Sultan owners only" on public.water_logs for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
grant select, insert, update, delete on table public.water_logs to authenticated;
