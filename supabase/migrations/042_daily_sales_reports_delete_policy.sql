drop policy if exists "admin delete daily sales reports" on public.daily_sales_reports;
create policy "admin delete daily sales reports" on public.daily_sales_reports
for delete using (
  public.is_admin()
);
