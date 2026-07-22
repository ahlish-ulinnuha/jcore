alter table public.vendors
add column if not exists auto_send_purchase boolean not null default false;
