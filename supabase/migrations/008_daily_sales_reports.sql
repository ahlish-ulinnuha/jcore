create table if not exists public.daily_sales_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  store_id uuid not null references public.stores(id),
  store_name text not null,
  system_nominal numeric(14, 2) not null default 0 check (system_nominal >= 0),
  cash_total numeric(14, 2) not null default 0 check (cash_total >= 0),
  cash_100000 integer not null default 0 check (cash_100000 >= 0),
  cash_50000 integer not null default 0 check (cash_50000 >= 0),
  cash_20000 integer not null default 0 check (cash_20000 >= 0),
  cash_10000 integer not null default 0 check (cash_10000 >= 0),
  cash_5000 integer not null default 0 check (cash_5000 >= 0),
  cash_2000 integer not null default 0 check (cash_2000 >= 0),
  cash_1000 integer not null default 0 check (cash_1000 >= 0),
  cash_500 integer not null default 0 check (cash_500 >= 0),
  cash_200 integer not null default 0 check (cash_200 >= 0),
  cash_100 integer not null default 0 check (cash_100 >= 0),
  qris numeric(14, 2) not null default 0 check (qris >= 0),
  debit numeric(14, 2) not null default 0 check (debit >= 0),
  shopee numeric(14, 2) not null default 0 check (shopee >= 0),
  expense numeric(14, 2) not null default 0 check (expense >= 0),
  expense_detail text,
  difference numeric(14, 2) not null default 0,
  notes text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_date, store_id)
);

create index if not exists daily_sales_reports_date_idx
on public.daily_sales_reports(report_date);

drop trigger if exists daily_sales_reports_touch_updated_at on public.daily_sales_reports;
create trigger daily_sales_reports_touch_updated_at
before update on public.daily_sales_reports
for each row execute function public.touch_updated_at();

alter table public.daily_sales_reports enable row level security;

drop policy if exists "staff admin read daily sales reports" on public.daily_sales_reports;
create policy "staff admin read daily sales reports" on public.daily_sales_reports
for select using (
  public.is_admin()
  or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and profiles.store_id = daily_sales_reports.store_id
  )
);

drop policy if exists "staff admin create daily sales reports" on public.daily_sales_reports;
create policy "staff admin create daily sales reports" on public.daily_sales_reports
for insert with check (
  public.is_admin()
  or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and profiles.store_id = daily_sales_reports.store_id
  )
);

drop policy if exists "staff admin update daily sales reports" on public.daily_sales_reports;
create policy "staff admin update daily sales reports" on public.daily_sales_reports
for update using (
  public.is_admin()
  or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and profiles.store_id = daily_sales_reports.store_id
  )
) with check (
  public.is_admin()
  or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and profiles.store_id = daily_sales_reports.store_id
  )
);
