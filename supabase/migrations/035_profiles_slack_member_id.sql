alter table public.profiles
add column if not exists slack_member_id text;
