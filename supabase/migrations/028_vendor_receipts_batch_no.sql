alter table public.vendor_receipts
add column if not exists batch_no integer;

create index if not exists vendor_receipts_batch_idx
on public.vendor_receipts(vendor_id, request_date, batch_no);
