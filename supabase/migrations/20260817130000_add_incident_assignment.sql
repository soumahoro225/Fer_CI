alter table public.incidents
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null;

alter table public.incidents drop constraint if exists incidents_status_check;
alter table public.incidents
  add constraint incidents_status_check
  check (status in ('À qualifier','Validé','Planifié','En traitement','Résolu','Rejeté'));

create index if not exists incidents_assigned_to_status_idx
  on public.incidents(assigned_to,status)
  where assigned_to is not null;

create or replace function private.validate_incident_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_to is not null and not exists (
    select 1
    from public.profiles profile
    where profile.id=new.assigned_to
      and profile.role in ('direction','agent')
  ) then
    raise exception 'incident assignee must be FER staff' using errcode='23514';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_incident_assignee() from public,anon,authenticated;

drop trigger if exists incidents_validate_assignee on public.incidents;
create trigger incidents_validate_assignee
before insert or update of assigned_to on public.incidents
for each row execute function private.validate_incident_assignee();

drop policy if exists profiles_select_authorized on public.profiles;
create policy profiles_select_authorized
on public.profiles
for select
to authenticated
using(
  id=(select auth.uid())
  or private.has_fer_role(array['direction'])
  or (private.has_fer_role(array['agent']) and role in ('direction','agent'))
);
