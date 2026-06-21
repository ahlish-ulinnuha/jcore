create extension if not exists "pgcrypto";

create type public.app_role as enum ('admin', 'staff', 'vendor');
create type public.item_status as enum (
  'requested',
  'confirmed',
  'unavailable',
  'partially_available',
  'fulfilled',
  'cancelled'
);
create type public.request_status as enum ('draft', 'submitted', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'staff',
  store_id uuid,
  store_name text,
  created_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles
add constraint profiles_store_id_fkey foreign key (store_id) references public.stores(id);

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.vendor_users (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references public.brands(id),
  sku text unique,
  name text not null,
  unit text not null default 'pcs',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.product_vendors (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, vendor_id)
);

create table public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  request_date date not null default current_date,
  batch_no integer not null default 1,
  status public.request_status not null default 'draft',
  store_id uuid references public.stores(id),
  store_name text not null,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.purchase_requests(id) on delete cascade,
  product_id uuid not null references public.products(id),
  vendor_id uuid not null references public.vendors(id),
  qty numeric(12, 2) not null check (qty > 0),
  unit text not null,
  status public.item_status not null default 'requested',
  vendor_note text,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_requests_date_idx on public.purchase_requests(request_date);
create index purchase_request_items_request_idx on public.purchase_request_items(request_id);
create index purchase_request_items_vendor_idx on public.purchase_request_items(vendor_id);
create unique index purchase_requests_store_date_batch_idx
on public.purchase_requests(store_name, request_date, batch_no);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.current_vendor_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select vendor_id from public.vendor_users where user_id = auth.uid();
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger purchase_request_items_touch_updated_at
before update on public.purchase_request_items
for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_users enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_vendors enable row level security;
alter table public.purchase_requests enable row level security;
alter table public.purchase_request_items enable row level security;

create policy "profiles can read self or admin" on public.profiles
for select using (id = auth.uid() or public.is_admin());

create policy "admins manage profiles" on public.profiles
for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read stores" on public.stores
for select using (auth.role() = 'authenticated');

create policy "admins manage stores" on public.stores
for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read vendors" on public.vendors
for select using (auth.role() = 'authenticated');

create policy "admins manage vendors" on public.vendors
for all using (public.is_admin()) with check (public.is_admin());

create policy "vendor users read own link" on public.vendor_users
for select using (user_id = auth.uid() or public.is_admin());

create policy "admins manage vendor users" on public.vendor_users
for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read brands" on public.brands
for select using (auth.role() = 'authenticated');

create policy "admins manage brands" on public.brands
for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read products" on public.products
for select using (auth.role() = 'authenticated');

create policy "admins manage products" on public.products
for all using (public.is_admin()) with check (public.is_admin());

create policy "authenticated read product vendors" on public.product_vendors
for select using (auth.role() = 'authenticated');

create policy "admins manage product vendors" on public.product_vendors
for all using (public.is_admin()) with check (public.is_admin());

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

create policy "staff and admin create request items" on public.purchase_request_items
for insert with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  )
);

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

create policy "staff admin and assigned vendor update items" on public.purchase_request_items
for update using (
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
) with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  )
  or vendor_id = public.current_vendor_id()
);

create policy "staff and admin delete request items" on public.purchase_request_items
for delete using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  )
);

insert into storage.buckets (id, name, public)
values ('vendor-receipts', 'vendor-receipts', true)
on conflict (id) do nothing;

create policy "authenticated upload receipts" on storage.objects
for insert with check (
  bucket_id = 'vendor-receipts'
  and auth.role() = 'authenticated'
);

create policy "authenticated read receipts" on storage.objects
for select using (
  bucket_id = 'vendor-receipts'
  and auth.role() = 'authenticated'
);
