do $$
begin
  create type public.request_status as enum ('draft', 'submitted', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.product_vendors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, vendor_id)
);

alter table public.purchase_requests
add column if not exists batch_no integer not null default 1,
add column if not exists status public.request_status not null default 'submitted',
add column if not exists store_name text;

update public.purchase_requests pr
set store_name = coalesce(p.store_name, 'Toko Utama')
from public.profiles p
where pr.created_by = p.id
  and pr.store_name is null;

update public.purchase_requests
set store_name = 'Toko Utama'
where store_name is null;

alter table public.purchase_requests
alter column store_name set not null;

create unique index if not exists purchase_requests_store_date_batch_idx
on public.purchase_requests(store_name, request_date, batch_no);

alter table public.product_vendors enable row level security;

drop policy if exists "authenticated read product vendors" on public.product_vendors;
create policy "authenticated read product vendors" on public.product_vendors
for select using (auth.role() = 'authenticated');

drop policy if exists "admins manage product vendors" on public.product_vendors;
create policy "admins manage product vendors" on public.product_vendors
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "staff and admin update requests" on public.purchase_requests;
create policy "staff and admin update requests" on public.purchase_requests
for update using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  )
) with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  )
);

drop policy if exists "staff and admin read requests" on public.purchase_requests;
drop policy if exists "staff admin and assigned vendor read requests" on public.purchase_requests;
create policy "staff admin and assigned vendor read requests" on public.purchase_requests
for select using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  )
  or exists (
    select 1
    from public.purchase_request_items pri
    where pri.request_id = purchase_requests.id
      and pri.vendor_id = public.current_vendor_id()
      and purchase_requests.status = 'submitted'
  )
);

drop policy if exists "staff admin and assigned vendor read items" on public.purchase_request_items;
create policy "staff admin and assigned vendor read items" on public.purchase_request_items
for select using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  )
  or (
    vendor_id = public.current_vendor_id()
    and exists (
      select 1 from public.purchase_requests pr
      where pr.id = purchase_request_items.request_id
        and pr.status = 'submitted'
    )
  )
);

drop policy if exists "staff and admin delete request items" on public.purchase_request_items;
create policy "staff and admin delete request items" on public.purchase_request_items
for delete using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  )
);
