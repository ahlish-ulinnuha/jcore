insert into public.shift_types (code, name, start_time, end_time, sort_order)
values
  ('OFF', 'Off', '00:00', '00:00', 70),
  ('OL', 'On Leave', '00:00', '00:00', 80)
on conflict (code) do update set
  name = excluded.name,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  sort_order = excluded.sort_order,
  is_active = true;
