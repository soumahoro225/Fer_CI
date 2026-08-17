begin;

do $$
begin
  if exists (select 1 from public.profiles where role='user') then
    raise exception 'generic user profiles must be migrated before removing the role';
  end if;
end
$$;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('direction','agent','citoyen'));

drop policy if exists incidents_insert_authorized on public.incidents;
create policy incidents_insert_authorized
on public.incidents for insert to authenticated
with check (
  created_by=(select auth.uid()) and (
    (private.has_fer_role(array['direction','agent']) and source='FER') or
    (
      private.has_fer_role(array['citoyen'])
      and source='Citoyen'
      and status='À qualifier'
      and severity='Modérée'
      and assigned_to is null
      and client_request_id is not null
      and location_source in ('gps','manual_map')
      and location_captured_at is not null
    )
  )
);

commit;
