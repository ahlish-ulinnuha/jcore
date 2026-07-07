alter table public.vendor_receipts
add column if not exists request_id uuid references public.purchase_requests(id) on delete set null;

create index if not exists vendor_receipts_request_idx
on public.vendor_receipts(request_id);
