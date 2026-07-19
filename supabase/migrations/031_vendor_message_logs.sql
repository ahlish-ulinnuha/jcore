create table if not exists public.vendor_message_logs (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  request_date date not null,
  batch_no integer not null default 0,
  channel text not null default 'whatsapp',
  message text not null,
  status text not null check (status in ('success', 'failed')),
  error_message text,
  sent_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists vendor_message_logs_vendor_date_idx
on public.vendor_message_logs(vendor_id, request_date, batch_no, created_at desc);

create index if not exists vendor_message_logs_date_idx
on public.vendor_message_logs(request_date, created_at desc);

alter table public.vendor_message_logs enable row level security;

drop policy if exists "authenticated read vendor message logs" on public.vendor_message_logs;
create policy "authenticated read vendor message logs" on public.vendor_message_logs
for select using (auth.role() = 'authenticated');

drop policy if exists "authenticated insert vendor message logs" on public.vendor_message_logs;
create policy "authenticated insert vendor message logs" on public.vendor_message_logs
for insert with check (auth.role() = 'authenticated');
