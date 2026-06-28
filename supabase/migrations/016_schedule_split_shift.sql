insert into public.shift_types (code, name, start_time, end_time, sort_order)
values
  ('SP', 'Split', '09:30', '22:00', 65)
on conflict (code) do update set
  name = excluded.name,
  start_time = excluded.start_time,
  end_time = excluded.end_time,
  sort_order = excluded.sort_order,
  is_active = true;
