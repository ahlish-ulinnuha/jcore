create or replace function public.has_menu_access(check_key text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select can_access
      from public.profile_menu_access
      where profile_id = auth.uid() and menu_key = check_key
      limit 1
    ),
    false
  );
$$;

drop policy if exists "granted all_schedules read schedules" on public.store_staff_schedules;
create policy "granted all_schedules read schedules" on public.store_staff_schedules
for select using (public.has_menu_access('all_schedules'));

drop policy if exists "granted all_schedules read staff profiles" on public.profiles;
create policy "granted all_schedules read staff profiles" on public.profiles
for select using (role = 'staff' and public.has_menu_access('all_schedules'));
