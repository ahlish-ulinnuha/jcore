alter table public.vendor_message_logs
add column if not exists source text not null default 'manual' check (source in ('manual', 'cron'));
