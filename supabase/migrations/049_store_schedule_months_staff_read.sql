-- Every staff member needs to read their own store's schedule-month
-- approval status to know whether their own schedule is visible yet
-- (used by /schedules, the dashboard widget, and /schedules/all).
-- Previously only admins and input_schedule-granted staff could read
-- store_schedule_months at all, so a plain staff's approval check
-- silently returned nothing and hid even already-approved schedules.

drop policy if exists "staff read own store schedule months" on public.store_schedule_months;
create policy "staff read own store schedule months" on public.store_schedule_months
for select using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'staff'
      and profiles.store_id = store_schedule_months.store_id
  )
);

-- Staff granted all_schedules (cross-store viewing) also need this for
-- every store shown on /schedules/all, not just their own.
drop policy if exists "granted all_schedules read schedule months" on public.store_schedule_months;
create policy "granted all_schedules read schedule months" on public.store_schedule_months
for select using (public.has_menu_access('all_schedules'));
