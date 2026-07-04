create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id),
  store_id uuid not null references public.stores(id),
  check_in_at timestamptz not null default now(),
  check_in_latitude numeric(9, 6) not null,
  check_in_longitude numeric(9, 6) not null,
  check_in_accuracy numeric(8, 2),
  check_in_distance_m numeric(9, 2),
  check_out_at timestamptz,
  check_out_latitude numeric(9, 6),
  check_out_longitude numeric(9, 6),
  check_out_accuracy numeric(8, 2),
  check_out_distance_m numeric(9, 2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_attendance_staff_idx
on public.staff_attendance(staff_id, check_in_at desc);

create index if not exists staff_attendance_store_date_idx
on public.staff_attendance(store_id, check_in_at desc);

create unique index if not exists staff_attendance_one_open_session_idx
on public.staff_attendance(staff_id)
where check_out_at is null;

drop trigger if exists staff_attendance_touch_updated_at on public.staff_attendance;
create trigger staff_attendance_touch_updated_at
before update on public.staff_attendance
for each row execute function public.touch_updated_at();

alter table public.staff_attendance enable row level security;

drop policy if exists "staff manage own attendance" on public.staff_attendance;
create policy "staff manage own attendance" on public.staff_attendance
for all using (staff_id = auth.uid())
with check (staff_id = auth.uid());

drop policy if exists "admin manage all attendance" on public.staff_attendance;
create policy "admin manage all attendance" on public.staff_attendance
for all using (public.is_admin())
with check (public.is_admin());
