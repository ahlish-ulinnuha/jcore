drop policy if exists "admin update shopping records" on public.shopping_records;
create policy "admin update shopping records" on public.shopping_records
for update using (public.is_admin())
with check (public.is_admin());
