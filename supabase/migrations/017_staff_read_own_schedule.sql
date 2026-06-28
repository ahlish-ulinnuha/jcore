drop policy if exists "staff read own schedules" on public.store_staff_schedules;
create policy "staff read own schedules" on public.store_staff_schedules
for select using (
  staff_id = auth.uid()
  or exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'staff'
      and profiles.id = store_staff_schedules.staff_id
  )
);
