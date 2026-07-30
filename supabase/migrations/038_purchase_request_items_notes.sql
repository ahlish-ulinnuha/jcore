alter table public.purchase_request_items
add column if not exists item_note text;
