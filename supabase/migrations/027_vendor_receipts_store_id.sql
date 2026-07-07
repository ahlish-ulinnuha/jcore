alter table public.vendor_receipts
add column if not exists store_id uuid references public.stores(id) on delete set null;

create index if not exists vendor_receipts_store_idx
on public.vendor_receipts(store_id);
