drop policy if exists "vendors insert own receipts" on public.vendor_receipts;
create policy "vendors insert own receipts" on public.vendor_receipts
for insert
with check (vendor_id = public.current_vendor_id());
