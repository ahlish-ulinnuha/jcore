alter table public.profiles
add column if not exists email text;

create index if not exists profiles_email_idx
on public.profiles(email);
