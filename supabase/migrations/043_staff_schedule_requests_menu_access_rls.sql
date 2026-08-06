drop policy if exists "granted schedule_requests read requests" on public.staff_schedule_requests;
create policy "granted schedule_requests read requests" on public.staff_schedule_requests
for select using (public.has_menu_access('schedule_requests'));

drop policy if exists "granted schedule_requests update requests" on public.staff_schedule_requests;
create policy "granted schedule_requests update requests" on public.staff_schedule_requests
for update using (public.has_menu_access('schedule_requests'))
with check (public.has_menu_access('schedule_requests'));

-- Approving a request also needs to read/create the target schedule month,
-- and read/write the resulting staff schedule cell + change log, none of
-- which previously allowed non-admins even with schedule_requests access.
drop policy if exists "granted schedule_requests read schedule months" on public.store_schedule_months;
create policy "granted schedule_requests read schedule months" on public.store_schedule_months
for select using (public.has_menu_access('schedule_requests'));

drop policy if exists "granted schedule_requests create schedule months" on public.store_schedule_months;
create policy "granted schedule_requests create schedule months" on public.store_schedule_months
for insert with check (public.has_menu_access('schedule_requests'));

drop policy if exists "granted schedule_requests read staff schedules" on public.store_staff_schedules;
create policy "granted schedule_requests read staff schedules" on public.store_staff_schedules
for select using (public.has_menu_access('schedule_requests'));

drop policy if exists "granted schedule_requests write staff schedules" on public.store_staff_schedules;
create policy "granted schedule_requests write staff schedules" on public.store_staff_schedules
for insert with check (public.has_menu_access('schedule_requests'));

drop policy if exists "granted schedule_requests update staff schedules" on public.store_staff_schedules;
create policy "granted schedule_requests update staff schedules" on public.store_staff_schedules
for update using (public.has_menu_access('schedule_requests'))
with check (public.has_menu_access('schedule_requests'));

drop policy if exists "granted schedule_requests write change logs" on public.store_schedule_change_logs;
create policy "granted schedule_requests write change logs" on public.store_schedule_change_logs
for insert with check (public.has_menu_access('schedule_requests'));

drop policy if exists "granted schedule_requests read staff profiles" on public.profiles;
create policy "granted schedule_requests read staff profiles" on public.profiles
for select using (role = 'staff' and public.has_menu_access('schedule_requests'));
