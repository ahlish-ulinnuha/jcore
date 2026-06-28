create table if not exists public.shift_types (
  code text primary key,
  name text not null,
  start_time time not null,
  end_time time not null,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

insert into public.shift_types (code, name, start_time, end_time, sort_order)
values
  ('P', 'Pagi', '09:30', '17:30', 10),
  ('M', 'Middle', '12:00', '20:00', 20),
  ('S', 'Siang', '14:00', '22:00', 30),
  ('F', 'Full', '09:30', '22:00', 40),
  ('MFP', 'Middle Full Pagi', '09:30', '20:30', 50),
  ('MF', 'Middle Full', '12:00', '22:00', 60)
on conflict (code) do update set
  name = excluded.name,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  sort_order = excluded.sort_order,
  is_active = true;

create table if not exists public.store_schedule_months (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  schedule_month date not null,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'approved')),
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, schedule_month)
);

create table if not exists public.store_staff_schedules (
  id uuid primary key default gen_random_uuid(),
  schedule_month_id uuid not null references public.store_schedule_months(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  staff_id uuid not null references public.profiles(id),
  work_date date not null,
  shift_code text references public.shift_types(code),
  notes text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, staff_id, work_date)
);

create index if not exists store_schedule_months_store_month_idx
on public.store_schedule_months(store_id, schedule_month);

create index if not exists store_staff_schedules_month_idx
on public.store_staff_schedules(schedule_month_id);

create index if not exists store_staff_schedules_store_date_idx
on public.store_staff_schedules(store_id, work_date);

drop trigger if exists store_schedule_months_touch_updated_at on public.store_schedule_months;
create trigger store_schedule_months_touch_updated_at
before update on public.store_schedule_months
for each row execute function public.touch_updated_at();

drop trigger if exists store_staff_schedules_touch_updated_at on public.store_staff_schedules;
create trigger store_staff_schedules_touch_updated_at
before update on public.store_staff_schedules
for each row execute function public.touch_updated_at();

alter table public.shift_types enable row level security;
alter table public.store_schedule_months enable row level security;
alter table public.store_staff_schedules enable row level security;

drop policy if exists "authenticated read shift types" on public.shift_types;
create policy "authenticated read shift types" on public.shift_types
for select using (auth.uid() is not null);

drop policy if exists "admin manage shift types" on public.shift_types;
create policy "admin manage shift types" on public.shift_types
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin manage schedule months" on public.store_schedule_months;
create policy "admin manage schedule months" on public.store_schedule_months
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin manage staff schedules" on public.store_staff_schedules;
create policy "admin manage staff schedules" on public.store_staff_schedules
for all using (public.is_admin())
with check (public.is_admin());
