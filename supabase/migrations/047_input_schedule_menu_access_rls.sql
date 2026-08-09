-- Staff granted input_schedule can read/write schedule data for their own
-- store only; input_schedule_all_store lifts the store restriction.
-- Both are additive alongside the existing admin-only "for all" policies.

drop policy if exists "granted input_schedule read schedule months" on public.store_schedule_months;
create policy "granted input_schedule read schedule months" on public.store_schedule_months
for select using (
  public.has_menu_access('input_schedule_all_store')
  or (
    public.has_menu_access('input_schedule')
    and exists (select 1 from public.profiles where id = auth.uid() and store_id = store_schedule_months.store_id)
  )
);

drop policy if exists "granted input_schedule write schedule months" on public.store_schedule_months;
create policy "granted input_schedule write schedule months" on public.store_schedule_months
for insert with check (
  public.has_menu_access('input_schedule_all_store')
  or (
    public.has_menu_access('input_schedule')
    and exists (select 1 from public.profiles where id = auth.uid() and store_id = store_schedule_months.store_id)
  )
);

drop policy if exists "granted input_schedule update schedule months" on public.store_schedule_months;
create policy "granted input_schedule update schedule months" on public.store_schedule_months
for update using (
  public.has_menu_access('input_schedule_all_store')
  or (
    public.has_menu_access('input_schedule')
    and exists (select 1 from public.profiles where id = auth.uid() and store_id = store_schedule_months.store_id)
  )
) with check (
  public.has_menu_access('input_schedule_all_store')
  or (
    public.has_menu_access('input_schedule')
    and exists (select 1 from public.profiles where id = auth.uid() and store_id = store_schedule_months.store_id)
  )
);

drop policy if exists "granted input_schedule read staff schedules" on public.store_staff_schedules;
create policy "granted input_schedule read staff schedules" on public.store_staff_schedules
for select using (
  public.has_menu_access('input_schedule_all_store')
  or (
    public.has_menu_access('input_schedule')
    and exists (select 1 from public.profiles where id = auth.uid() and store_id = store_staff_schedules.store_id)
  )
);

drop policy if exists "granted input_schedule write staff schedules" on public.store_staff_schedules;
create policy "granted input_schedule write staff schedules" on public.store_staff_schedules
for insert with check (
  public.has_menu_access('input_schedule_all_store')
  or (
    public.has_menu_access('input_schedule')
    and exists (select 1 from public.profiles where id = auth.uid() and store_id = store_staff_schedules.store_id)
  )
);

drop policy if exists "granted input_schedule update staff schedules" on public.store_staff_schedules;
create policy "granted input_schedule update staff schedules" on public.store_staff_schedules
for update using (
  public.has_menu_access('input_schedule_all_store')
  or (
    public.has_menu_access('input_schedule')
    and exists (select 1 from public.profiles where id = auth.uid() and store_id = store_staff_schedules.store_id)
  )
) with check (
  public.has_menu_access('input_schedule_all_store')
  or (
    public.has_menu_access('input_schedule')
    and exists (select 1 from public.profiles where id = auth.uid() and store_id = store_staff_schedules.store_id)
  )
);

drop policy if exists "granted input_schedule delete staff schedules" on public.store_staff_schedules;
create policy "granted input_schedule delete staff schedules" on public.store_staff_schedules
for delete using (
  public.has_menu_access('input_schedule_all_store')
  or (
    public.has_menu_access('input_schedule')
    and exists (select 1 from public.profiles where id = auth.uid() and store_id = store_staff_schedules.store_id)
  )
);

drop policy if exists "granted input_schedule write change logs" on public.store_schedule_change_logs;
create policy "granted input_schedule write change logs" on public.store_schedule_change_logs
for insert with check (
  public.has_menu_access('input_schedule_all_store')
  or (
    public.has_menu_access('input_schedule')
    and exists (select 1 from public.profiles where id = auth.uid() and store_id = store_schedule_change_logs.store_id)
  )
);

drop policy if exists "granted input_schedule write activity logs" on public.store_schedule_activity_logs;
create policy "granted input_schedule write activity logs" on public.store_schedule_activity_logs
for insert with check (
  public.has_menu_access('input_schedule_all_store')
  or (
    public.has_menu_access('input_schedule')
    and exists (select 1 from public.profiles where id = auth.uid() and store_id = store_schedule_activity_logs.store_id)
  )
);

-- The staff builder view lists all staff of the selected store, not just
-- themselves, same as the admin builder does.
drop policy if exists "granted input_schedule read staff profiles" on public.profiles;
create policy "granted input_schedule read staff profiles" on public.profiles
for select using (
  role = 'staff'
  and (
    public.has_menu_access('input_schedule_all_store')
    or (
      public.has_menu_access('input_schedule')
      and exists (
        select 1 from public.profiles viewer
        where viewer.id = auth.uid() and viewer.store_id = profiles.store_id
      )
    )
  )
);
