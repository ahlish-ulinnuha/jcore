-- The "granted input_schedule read staff profiles" policy (047) queried
-- public.profiles from within a policy ON public.profiles, which
-- re-triggers the same RLS policy recursively (infinite recursion,
-- Postgres error 42P17). Fix by resolving the caller's store_id through
-- a SECURITY DEFINER function (same pattern as is_admin()/has_menu_access()),
-- which bypasses RLS instead of re-evaluating it.

create or replace function public.current_store_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select store_id from public.profiles where id = auth.uid() limit 1;
$$;

drop policy if exists "granted input_schedule read staff profiles" on public.profiles;
create policy "granted input_schedule read staff profiles" on public.profiles
for select using (
  role = 'staff'
  and (
    public.has_menu_access('input_schedule_all_store')
    or (
      public.has_menu_access('input_schedule')
      and store_id = public.current_store_id()
    )
  )
);
