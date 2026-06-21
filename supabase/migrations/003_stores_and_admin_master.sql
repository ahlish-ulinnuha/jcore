create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.stores enable row level security;

drop policy if exists "authenticated read stores" on public.stores;
create policy "authenticated read stores" on public.stores
for select using (auth.role() = 'authenticated');

drop policy if exists "admins manage stores" on public.stores;
create policy "admins manage stores" on public.stores
for all using (public.is_admin()) with check (public.is_admin());

alter table public.profiles
add column if not exists store_id uuid references public.stores(id);

insert into public.stores (name, code)
select distinct store_name, upper(left(regexp_replace(store_name, '\s+', '', 'g'), 12))
from public.profiles
where store_name is not null
on conflict (name) do nothing;

update public.profiles p
set store_id = s.id
from public.stores s
where p.store_id is null
  and p.store_name = s.name;

alter table public.purchase_requests
add column if not exists store_id uuid references public.stores(id);

update public.purchase_requests pr
set store_id = s.id
from public.stores s
where pr.store_id is null
  and pr.store_name = s.name;

drop policy if exists "staff and admin create requests" on public.purchase_requests;
create policy "staff and admin create requests" on public.purchase_requests
for insert with check (
  public.is_admin()
  or exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and profiles.store_id = purchase_requests.store_id
  )
);

drop policy if exists "staff admin and assigned vendor read requests" on public.purchase_requests;
create policy "staff admin and assigned vendor read requests" on public.purchase_requests
for select using (
  public.is_admin()
  or exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and profiles.store_id = purchase_requests.store_id
  )
  or exists (
    select 1
    from public.purchase_request_items pri
    where pri.request_id = purchase_requests.id
      and pri.vendor_id = public.current_vendor_id()
      and purchase_requests.status = 'submitted'
  )
);

drop policy if exists "staff and admin update requests" on public.purchase_requests;
create policy "staff and admin update requests" on public.purchase_requests
for update using (
  public.is_admin()
  or exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and profiles.store_id = purchase_requests.store_id
  )
) with check (
  public.is_admin()
  or exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'staff'
      and profiles.store_id = purchase_requests.store_id
  )
);
