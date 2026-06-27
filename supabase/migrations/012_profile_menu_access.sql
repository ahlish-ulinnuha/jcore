create table if not exists public.profile_menu_access (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  menu_key text not null,
  can_access boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, menu_key)
);

create index if not exists profile_menu_access_profile_idx
on public.profile_menu_access(profile_id);

drop trigger if exists profile_menu_access_touch_updated_at on public.profile_menu_access;
create trigger profile_menu_access_touch_updated_at
before update on public.profile_menu_access
for each row execute function public.touch_updated_at();

alter table public.profile_menu_access enable row level security;

drop policy if exists "profiles read own menu access or admin" on public.profile_menu_access;
create policy "profiles read own menu access or admin" on public.profile_menu_access
for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "admins manage menu access" on public.profile_menu_access;
create policy "admins manage menu access" on public.profile_menu_access
for all using (public.is_admin())
with check (public.is_admin());
