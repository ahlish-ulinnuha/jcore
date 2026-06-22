insert into storage.buckets (id, name, public)
values ('vendor-receipts', 'vendor-receipts', true)
on conflict (id) do update set public = true;

drop policy if exists "authenticated upload receipts" on storage.objects;
create policy "authenticated upload receipts" on storage.objects
for insert with check (
  bucket_id = 'vendor-receipts'
  and auth.role() = 'authenticated'
);

drop policy if exists "authenticated read receipts" on storage.objects;
create policy "authenticated read receipts" on storage.objects
for select using (
  bucket_id = 'vendor-receipts'
  and auth.role() = 'authenticated'
);

drop policy if exists "authenticated update receipts" on storage.objects;
create policy "authenticated update receipts" on storage.objects
for update using (
  bucket_id = 'vendor-receipts'
  and auth.role() = 'authenticated'
) with check (
  bucket_id = 'vendor-receipts'
  and auth.role() = 'authenticated'
);

drop policy if exists "staff admin and assigned vendor update items" on public.purchase_request_items;
create policy "staff admin and assigned vendor update items" on public.purchase_request_items
for update using (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  )
  or (
    vendor_id = public.current_vendor_id()
    and exists (
      select 1 from public.purchase_requests pr
      where pr.id = purchase_request_items.request_id
        and pr.status = 'submitted'
    )
  )
) with check (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'staff')
  )
  or (
    vendor_id = public.current_vendor_id()
    and exists (
      select 1 from public.purchase_requests pr
      where pr.id = purchase_request_items.request_id
        and pr.status = 'submitted'
    )
  )
);
