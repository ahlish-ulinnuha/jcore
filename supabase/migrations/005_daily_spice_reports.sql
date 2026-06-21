create table if not exists public.daily_spice_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  store_id uuid not null references public.stores(id),
  store_name text not null,
  red_spice_stock numeric(12, 2) not null default 0 check (red_spice_stock >= 0),
  white_spice_stock numeric(12, 2) not null default 0 check (white_spice_stock >= 0),
  notes text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_date, store_id)
);

create index if not exists daily_spice_reports_date_idx
on public.daily_spice_reports(report_date);

drop trigger if exists daily_spice_reports_touch_updated_at on public.daily_spice_reports;
create trigger daily_spice_reports_touch_updated_at
before update on public.daily_spice_reports
for each row execute function public.touch_updated_at();

alter table public.daily_spice_reports enable row level security;

drop policy if exists "staff admin read daily spice reports" on public.daily_spice_reports;
create policy "staff admin read daily spice reports" on public.daily_spice_reports
for select using (
  public.is_admin()
  or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and profiles.store_id = daily_spice_reports.store_id
  )
);

drop policy if exists "staff admin create daily spice reports" on public.daily_spice_reports;
create policy "staff admin create daily spice reports" on public.daily_spice_reports
for insert with check (
  public.is_admin()
  or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and profiles.store_id = daily_spice_reports.store_id
  )
);

drop policy if exists "staff admin update daily spice reports" on public.daily_spice_reports;
create policy "staff admin update daily spice reports" on public.daily_spice_reports
for update using (
  public.is_admin()
  or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and profiles.store_id = daily_spice_reports.store_id
  )
) with check (
  public.is_admin()
  or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and profiles.store_id = daily_spice_reports.store_id
  )
);
