alter table public.daily_sales_reports
add column if not exists grab numeric(14, 2) not null default 0 check (grab >= 0),
add column if not exists gojek numeric(14, 2) not null default 0 check (gojek >= 0);
