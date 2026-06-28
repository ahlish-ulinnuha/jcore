create table if not exists public.store_schedule_activity_logs (
  id uuid primary key default gen_random_uuid(),
  schedule_month_id uuid not null references public.store_schedule_months(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  action text not null check (action in ('save_draft', 'submit', 'approve')),
  week_no integer,
  date_from date,
  date_to date,
  summary text,
  actor_id uuid references public.profiles(id),
  actor_name text,
  created_at timestamptz not null default now()
);

create index if not exists store_schedule_activity_logs_month_idx
on public.store_schedule_activity_logs(schedule_month_id, created_at desc);

alter table public.store_schedule_activity_logs enable row level security;

drop policy if exists "admin manage schedule activity logs" on public.store_schedule_activity_logs;
create policy "admin manage schedule activity logs" on public.store_schedule_activity_logs
for all using (public.is_admin())
with check (public.is_admin());
