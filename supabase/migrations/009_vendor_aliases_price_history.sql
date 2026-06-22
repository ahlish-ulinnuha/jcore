create table if not exists public.product_vendor_aliases (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  alias_name text not null,
  normalized_alias_name text not null,
  confidence numeric(4, 3) not null default 1 check (confidence >= 0 and confidence <= 1),
  is_active boolean not null default true,
  notes text,
  last_used_at timestamptz,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, normalized_alias_name)
);

create index if not exists product_vendor_aliases_product_idx
on public.product_vendor_aliases(product_id);

create index if not exists product_vendor_aliases_vendor_idx
on public.product_vendor_aliases(vendor_id);

drop trigger if exists product_vendor_aliases_touch_updated_at on public.product_vendor_aliases;
create trigger product_vendor_aliases_touch_updated_at
before update on public.product_vendor_aliases
for each row execute function public.touch_updated_at();

create table if not exists public.product_vendor_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  current_price numeric(14, 2) not null default 0 check (current_price >= 0),
  last_source text,
  last_source_id uuid,
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, vendor_id)
);

create index if not exists product_vendor_prices_vendor_idx
on public.product_vendor_prices(vendor_id);

drop trigger if exists product_vendor_prices_touch_updated_at on public.product_vendor_prices;
create trigger product_vendor_prices_touch_updated_at
before update on public.product_vendor_prices
for each row execute function public.touch_updated_at();

create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  old_price numeric(14, 2),
  new_price numeric(14, 2) not null check (new_price >= 0),
  price_diff numeric(14, 2) generated always as (new_price - coalesce(old_price, 0)) stored,
  price_diff_percent numeric(10, 4) generated always as (
    case
      when old_price is null or old_price = 0 then null
      else ((new_price - old_price) / old_price) * 100
    end
  ) stored,
  source text,
  source_id uuid,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

create index if not exists product_price_history_product_vendor_idx
on public.product_price_history(product_id, vendor_id, changed_at desc);

alter table public.product_vendor_aliases enable row level security;
alter table public.product_vendor_prices enable row level security;
alter table public.product_price_history enable row level security;

drop policy if exists "admin staff read vendor aliases" on public.product_vendor_aliases;
create policy "admin staff read vendor aliases" on public.product_vendor_aliases
for select using (
  public.is_admin()
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'staff')
);

drop policy if exists "admin write vendor aliases" on public.product_vendor_aliases;
create policy "admin write vendor aliases" on public.product_vendor_aliases
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin staff read vendor prices" on public.product_vendor_prices;
create policy "admin staff read vendor prices" on public.product_vendor_prices
for select using (
  public.is_admin()
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'staff')
);

drop policy if exists "admin write vendor prices" on public.product_vendor_prices;
create policy "admin write vendor prices" on public.product_vendor_prices
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin staff read price history" on public.product_price_history;
create policy "admin staff read price history" on public.product_price_history
for select using (
  public.is_admin()
  or exists (select 1 from public.profiles where id = auth.uid() and role = 'staff')
);

drop policy if exists "admin write price history" on public.product_price_history;
create policy "admin write price history" on public.product_price_history
for all using (public.is_admin())
with check (public.is_admin());
