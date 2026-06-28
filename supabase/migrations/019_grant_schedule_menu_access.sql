insert into public.profile_menu_access (profile_id, menu_key, can_access)
select id, 'schedules', true
from public.profiles
where role in ('admin', 'staff')
on conflict (profile_id, menu_key) do update set
  can_access = true;
