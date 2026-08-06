create table if not exists public.shopping_records (
  id uuid primary key default gen_random_uuid(),
  record_date date not null,
  store_id uuid not null references public.stores(id),
  store_name text not null,
  store_code text,
  description text not null,
  total_price numeric(14, 2) not null default 0 check (total_price >= 0),
  category text not null default 'belanja',
  payment_method text not null default 'cash',
  payment_status text not null default 'unpaid' check (payment_status in ('paid', 'unpaid')),
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shopping_records_date_idx
on public.shopping_records(record_date desc);

create index if not exists shopping_records_store_idx
on public.shopping_records(store_id, record_date desc);

drop trigger if exists shopping_records_touch_updated_at on public.shopping_records;
create trigger shopping_records_touch_updated_at
before update on public.shopping_records
for each row execute function public.touch_updated_at();

alter table public.shopping_records enable row level security;

drop policy if exists "staff admin read shopping records" on public.shopping_records;
create policy "staff admin read shopping records" on public.shopping_records
for select using (
  public.is_admin()
  or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and profiles.store_id = shopping_records.store_id
  )
);

drop policy if exists "staff admin create shopping records" on public.shopping_records;
create policy "staff admin create shopping records" on public.shopping_records
for insert with check (
  public.is_admin()
  or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and profiles.store_id = shopping_records.store_id
  )
);

drop policy if exists "admin delete shopping records" on public.shopping_records;
create policy "admin delete shopping records" on public.shopping_records
for delete using (public.is_admin());
