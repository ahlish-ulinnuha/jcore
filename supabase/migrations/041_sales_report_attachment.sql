alter table public.daily_sales_reports add column if not exists attachment_url text;
alter table public.daily_sales_reports add column if not exists attachment_name text;

insert into storage.buckets (id, name, public)
values ('sales-report-attachments', 'sales-report-attachments', true)
on conflict (id) do update set public = true;

drop policy if exists "authenticated upload sales report attachments" on storage.objects;
create policy "authenticated upload sales report attachments" on storage.objects
for insert with check (
  bucket_id = 'sales-report-attachments'
  and auth.role() = 'authenticated'
);

drop policy if exists "authenticated read sales report attachments" on storage.objects;
create policy "authenticated read sales report attachments" on storage.objects
for select using (
  bucket_id = 'sales-report-attachments'
  and auth.role() = 'authenticated'
);

drop policy if exists "authenticated update sales report attachments" on storage.objects;
create policy "authenticated update sales report attachments" on storage.objects
for update using (
  bucket_id = 'sales-report-attachments'
  and auth.role() = 'authenticated'
) with check (
  bucket_id = 'sales-report-attachments'
  and auth.role() = 'authenticated'
);
