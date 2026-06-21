alter table public.purchase_requests
add column if not exists updated_at timestamptz not null default now();

drop trigger if exists purchase_requests_touch_updated_at on public.purchase_requests;
create trigger purchase_requests_touch_updated_at
before update on public.purchase_requests
for each row execute function public.touch_updated_at();

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid references public.profiles(id),
  actor_name text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_entity_idx
on public.activity_logs(entity_type, entity_id, created_at desc);

create index if not exists activity_logs_actor_idx
on public.activity_logs(actor_id, created_at desc);

alter table public.activity_logs enable row level security;

drop policy if exists "staff admin read activity logs" on public.activity_logs;
create policy "staff admin read activity logs" on public.activity_logs
for select using (
  public.is_admin()
  or exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'staff'
  )
);

drop policy if exists "staff admin create activity logs" on public.activity_logs;
create policy "staff admin create activity logs" on public.activity_logs
for insert with check (
  actor_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'staff')
  )
);
