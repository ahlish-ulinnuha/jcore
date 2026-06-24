alter table public.purchase_request_items
add column if not exists purchased_qty numeric(12, 2),
add column if not exists purchase_price numeric(14, 2);

create table if not exists public.vendor_receipts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  request_date date not null,
  receipt_url text not null,
  file_name text,
  notes text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists vendor_receipts_vendor_date_idx
on public.vendor_receipts(vendor_id, request_date, created_at desc);

alter table public.vendor_receipts enable row level security;

drop policy if exists "admin manage vendor receipts" on public.vendor_receipts;
create policy "admin manage vendor receipts" on public.vendor_receipts
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assigned vendors read own receipts" on public.vendor_receipts;
create policy "assigned vendors read own receipts" on public.vendor_receipts
for select using (vendor_id = public.current_vendor_id());
