create table if not exists public.staff_schedule_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  staff_id uuid not null references public.profiles(id),
  request_date date not null,
  shift_code text not null references public.shift_types(code),
  notes text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists staff_schedule_requests_store_date_idx
on public.staff_schedule_requests(store_id, request_date desc);

create index if not exists staff_schedule_requests_staff_idx
on public.staff_schedule_requests(staff_id, created_at desc);

drop trigger if exists staff_schedule_requests_touch_updated_at on public.staff_schedule_requests;
create trigger staff_schedule_requests_touch_updated_at
before update on public.staff_schedule_requests
for each row execute function public.touch_updated_at();

alter table public.staff_schedule_requests enable row level security;

drop policy if exists "staff read own schedule requests" on public.staff_schedule_requests;
create policy "staff read own schedule requests" on public.staff_schedule_requests
for select using (staff_id = auth.uid() or public.is_admin());

drop policy if exists "staff create own schedule requests" on public.staff_schedule_requests;
create policy "staff create own schedule requests" on public.staff_schedule_requests
for insert with check (
  staff_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'staff'
      and profiles.store_id = staff_schedule_requests.store_id
  )
);

drop policy if exists "admin update schedule requests" on public.staff_schedule_requests;
create policy "admin update schedule requests" on public.staff_schedule_requests
for update using (public.is_admin())
with check (public.is_admin());
