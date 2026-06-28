create table if not exists public.store_schedule_change_logs (
  id uuid primary key default gen_random_uuid(),
  schedule_month_id uuid not null references public.store_schedule_months(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  staff_id uuid references public.profiles(id),
  staff_name text,
  work_date date not null,
  old_shift_code text,
  new_shift_code text,
  old_notes text,
  new_notes text,
  action text not null default 'update' check (action in ('create', 'update', 'delete')),
  actor_id uuid references public.profiles(id),
  actor_name text,
  created_at timestamptz not null default now()
);

create index if not exists store_schedule_change_logs_month_idx
on public.store_schedule_change_logs(schedule_month_id, created_at desc);

create index if not exists store_schedule_change_logs_store_date_idx
on public.store_schedule_change_logs(store_id, work_date desc);

alter table public.store_schedule_change_logs enable row level security;

drop policy if exists "admin manage schedule change logs" on public.store_schedule_change_logs;
create policy "admin manage schedule change logs" on public.store_schedule_change_logs
for all using (public.is_admin())
with check (public.is_admin());
