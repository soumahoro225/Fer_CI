begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('direction','agent','citoyen','user'));

alter table public.interventions drop constraint if exists interventions_incident_id_fkey;
alter table public.interventions
  add constraint interventions_incident_id_fkey
  foreign key (incident_id) references public.incidents(id) on delete set null;

drop policy if exists incidents_insert_authorized on public.incidents;
create policy incidents_insert_authorized
on public.incidents for insert to authenticated
with check (
  created_by=(select auth.uid()) and (
    (private.has_fer_role(array['direction','agent']) and source='FER') or
    (
      private.has_fer_role(array['user'])
      and source='FER'
      and status='À qualifier'
      and severity='Modérée'
      and assigned_to is null
      and client_request_id is not null
      and location_source in ('gps','manual_map')
      and location_captured_at is not null
    ) or
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

drop policy if exists direction_delete_incidents on public.incidents;
create policy direction_delete_incidents
on public.incidents for delete to authenticated
using (private.has_fer_role(array['direction']));

revoke all on public.incidents from anon, authenticated;
grant select, insert, update, delete on public.incidents to authenticated;

drop policy if exists incident_evidence_storage_select on storage.objects;
create policy incident_evidence_storage_select
on storage.objects for select to authenticated
using (
  bucket_id='incident-evidence'
  and (
    private.has_fer_role(array['direction'])
    or exists (
      select 1
      from public.incidents incident
      where incident.id::text=(storage.foldername(name))[2]
        and (
          incident.created_by=(select auth.uid())
          or private.has_fer_role(array['agent'])
        )
    )
  )
);

drop policy if exists incident_evidence_storage_delete_direction on storage.objects;
create policy incident_evidence_storage_delete_direction
on storage.objects for delete to authenticated
using (
  bucket_id='incident-evidence'
  and private.has_fer_role(array['direction'])
);

commit;
