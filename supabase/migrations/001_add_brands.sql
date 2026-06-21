create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products
add column if not exists brand_id uuid references public.brands(id);

alter table public.brands enable row level security;

drop policy if exists "authenticated read brands" on public.brands;
create policy "authenticated read brands" on public.brands
for select using (auth.role() = 'authenticated');

drop policy if exists "admins manage brands" on public.brands;
create policy "admins manage brands" on public.brands
for all using (public.is_admin()) with check (public.is_admin());
