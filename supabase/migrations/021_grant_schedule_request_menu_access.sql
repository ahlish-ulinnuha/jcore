insert into public.profile_menu_access (profile_id, menu_key, can_access)
select id, 'schedule_requests', true
from public.profiles
where role = 'admin'
on conflict (profile_id, menu_key) do update set
  can_access = true;
