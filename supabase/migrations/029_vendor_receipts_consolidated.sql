insert into storage.buckets (id, name, public)
values ('vendor-receipts', 'vendor-receipts', true)
on conflict (id) do update set public = true;

drop policy if exists "authenticated upload receipts" on storage.objects;
create policy "authenticated upload receipts" on storage.objects
for insert with check (
  bucket_id = 'vendor-receipts'
  and auth.role() = 'authenticated'
);

drop policy if exists "authenticated read receipts" on storage.objects;
create policy "authenticated read receipts" on storage.objects
for select using (
  bucket_id = 'vendor-receipts'
  and auth.role() = 'authenticated'
);

drop policy if exists "authenticated update receipts" on storage.objects;
create policy "authenticated update receipts" on storage.objects
for update using (
  bucket_id = 'vendor-receipts'
  and auth.role() = 'authenticated'
) with check (
  bucket_id = 'vendor-receipts'
  and auth.role() = 'authenticated'
);

create table if not exists public.vendor_receipts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  request_id uuid references public.purchase_requests(id) on delete set null,
  store_id uuid references public.stores(id) on delete set null,
  batch_no integer,
  request_date date not null,
  receipt_url text not null,
  file_name text,
  notes text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.vendor_receipts
add column if not exists request_id uuid references public.purchase_requests(id) on delete set null,
add column if not exists store_id uuid references public.stores(id) on delete set null,
add column if not exists batch_no integer;

create index if not exists vendor_receipts_vendor_date_idx
on public.vendor_receipts(vendor_id, request_date, created_at desc);

create index if not exists vendor_receipts_request_idx
on public.vendor_receipts(request_id);

create index if not exists vendor_receipts_store_idx
on public.vendor_receipts(store_id);

create index if not exists vendor_receipts_batch_idx
on public.vendor_receipts(vendor_id, request_date, batch_no);

alter table public.vendor_receipts enable row level security;

drop policy if exists "admin manage vendor receipts" on public.vendor_receipts;
create policy "admin manage vendor receipts" on public.vendor_receipts
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assigned vendors read own receipts" on public.vendor_receipts;
create policy "assigned vendors read own receipts" on public.vendor_receipts
for select using (vendor_id = public.current_vendor_id());

drop policy if exists "vendors insert own receipts" on public.vendor_receipts;
create policy "vendors insert own receipts" on public.vendor_receipts
for insert
with check (vendor_id = public.current_vendor_id());
