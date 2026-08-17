alter table public.incidents
  drop constraint if exists incidents_location_source_check;

alter table public.incidents
  add constraint incidents_location_source_check
  check (location_source is null or location_source in ('gps','manual_map','ip'));
