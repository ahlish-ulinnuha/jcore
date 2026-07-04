alter table public.stores
add column if not exists latitude numeric(9, 6),
add column if not exists longitude numeric(9, 6),
add column if not exists geofence_radius_m integer not null default 150;
