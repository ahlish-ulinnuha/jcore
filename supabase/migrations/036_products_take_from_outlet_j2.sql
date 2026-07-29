alter table public.products
add column if not exists take_from_outlet_j2 boolean not null default false;
