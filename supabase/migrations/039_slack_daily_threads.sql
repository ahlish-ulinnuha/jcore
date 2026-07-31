create table if not exists public.slack_daily_threads (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null,
  thread_date date not null,
  thread_type text not null default 'daily_report',
  thread_ts text not null,
  created_at timestamptz not null default now(),
  unique (channel_id, thread_date, thread_type)
);

alter table public.slack_daily_threads enable row level security;

drop policy if exists "authenticated read slack daily threads" on public.slack_daily_threads;
create policy "authenticated read slack daily threads" on public.slack_daily_threads
for select using (auth.role() = 'authenticated');
