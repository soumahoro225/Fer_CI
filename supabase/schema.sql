-- GEOSIGNALE-CI — schéma réexécutable de référence pour Supabase.
create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null check (role in ('direction','agent','citoyen','user')),
  created_at timestamptz not null default now()
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  reference text unique not null default ('FER-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  title text not null,
  category text not null,
  location text not null,
  severity text not null default 'Modérée' check (severity in ('Critique','Élevée','Modérée')),
  status text not null default 'À qualifier',
  observations text,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  source text not null default 'FER' check (source in ('FER','Citoyen')),
  location_source text check (location_source is null or location_source in ('gps','manual_map','ip')),
  location_accuracy_m double precision check (location_accuracy_m is null or location_accuracy_m between 0 and 100000),
  location_captured_at timestamptz,
  client_request_id uuid,
  reporter_first_name text,
  reporter_last_name text,
  reporter_phone text,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint incidents_reference_format_check check (reference ~ '^FER-[A-Z0-9]{8,16}$')
);

create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(), incident_id uuid references public.incidents(id) on delete set null,
  type text not null, contractor text not null, progress integer not null default 0 check(progress between 0 and 100),
  budget_fcfa bigint not null default 0, committed_fcfa bigint not null default 0,
  planned_start date, planned_end date, status text not null default 'Planifiée',
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);

create table if not exists public.incident_evidence (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image','video')),
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/webm','video/quicktime','video/3gpp')),
  size_bytes bigint not null check (size_bytes between 1 and 41943040),
  original_name text not null check (char_length(original_name) between 1 and 200),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(), code text unique not null,
  type text not null check(type in ('feu','ouvrage','bac','péage','pesage','aire_repos','route')),
  name text not null, condition text not null, latitude double precision not null,
  longitude double precision not null, last_inspection date, created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(), reference text unique not null,
  contractor text not null, amount_fcfa bigint not null, received_at date not null,
  paid_at date, status text not null default 'En instruction', created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(), source text not null,
  year integer not null, target_fcfa bigint not null, collected_fcfa bigint not null default 0,
  unique(source,year)
);

-- Évolutions réexécutables si le schéma initial existait déjà.
alter table public.profiles add column if not exists phone text;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('direction','agent','citoyen','user'));
alter table public.profiles drop constraint if exists profiles_phone_format_check;
alter table public.profiles add constraint profiles_phone_format_check check (phone is null or phone ~ '^[+][1-9][0-9]{7,14}$');
alter table public.incidents add column if not exists source text not null default 'FER';
alter table public.incidents add column if not exists location_source text;
alter table public.incidents drop constraint if exists incidents_location_source_check;
alter table public.incidents add constraint incidents_location_source_check check (location_source is null or location_source in ('gps','manual_map','ip'));
alter table public.incidents add column if not exists location_accuracy_m double precision;
alter table public.incidents add column if not exists location_captured_at timestamptz;
alter table public.incidents add column if not exists client_request_id uuid;
alter table public.incidents add column if not exists reporter_first_name text;
alter table public.incidents add column if not exists reporter_last_name text;
alter table public.incidents add column if not exists reporter_phone text;
alter table public.incidents add column if not exists assigned_to uuid references public.profiles(id) on delete set null;
alter table public.interventions drop constraint if exists interventions_incident_id_fkey;
alter table public.interventions add constraint interventions_incident_id_fkey foreign key (incident_id) references public.incidents(id) on delete set null;
alter table public.incidents alter column reference set default ('FER-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)));
alter table public.incidents drop constraint if exists incidents_status_check;
alter table public.incidents add constraint incidents_status_check check (status in ('À qualifier','Validé','Planifié','En traitement','Résolu','Rejeté'));

do $$
begin
  if not exists (select 1 from pg_constraint where conname='incidents_reporter_first_name_length_check' and conrelid='public.incidents'::regclass) then
    alter table public.incidents add constraint incidents_reporter_first_name_length_check check (reporter_first_name is null or char_length(reporter_first_name) between 1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='incidents_reporter_last_name_length_check' and conrelid='public.incidents'::regclass) then
    alter table public.incidents add constraint incidents_reporter_last_name_length_check check (reporter_last_name is null or char_length(reporter_last_name) between 1 and 100);
  end if;
  if not exists (select 1 from pg_constraint where conname='incidents_reporter_phone_format_check' and conrelid='public.incidents'::regclass) then
    alter table public.incidents add constraint incidents_reporter_phone_format_check check (reporter_phone is null or reporter_phone ~ '^[+0-9][0-9 .()/-]{6,29}$');
  end if;
end
$$;

create unique index if not exists profiles_phone_unique on public.profiles(phone) where phone is not null;
create unique index if not exists incidents_client_request_unique on public.incidents(client_request_id) where client_request_id is not null;
create index if not exists incidents_created_by_created_at_idx on public.incidents(created_by,created_at desc);
create index if not exists incidents_assigned_to_status_idx on public.incidents(assigned_to,status) where assigned_to is not null;
create index if not exists interventions_created_by_idx on public.interventions(created_by);
create index if not exists interventions_incident_id_idx on public.interventions(incident_id);
create index if not exists incident_evidence_incident_created_idx on public.incident_evidence(incident_id,created_at);
create index if not exists incident_evidence_uploaded_by_idx on public.incident_evidence(uploaded_by);

create or replace function private.has_fer_role(allowed_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role=any(allowed_roles)
  );
$$;

create or replace function private.sync_auth_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  display_name text;
  contact_phone text;
begin
  display_name := left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'),''),nullif(btrim(new.raw_user_meta_data->>'name'),''),'Citoyen'),120);
  contact_phone := nullif(btrim(new.raw_user_meta_data->>'contact_phone'),'');
  if contact_phone is not null and contact_phone !~ '^[+][1-9][0-9]{7,14}$' then contact_phone := null; end if;
  insert into public.profiles(id,full_name,phone,role) values(new.id,display_name,contact_phone,'citoyen') on conflict(id) do nothing;
  return new;
end;
$$;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;

create or replace function private.protect_incident_owner()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.created_by is distinct from old.created_by then raise exception 'incident owner cannot be changed'; end if;
  return new;
end;
$$;

create or replace function private.validate_incident_assignee()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.assigned_to is not null and not exists (
    select 1 from public.profiles profile where profile.id=new.assigned_to and profile.role in ('direction','agent')
  ) then
    raise exception 'incident assignee must be FER staff' using errcode='23514';
  end if;
  return new;
end;
$$;

revoke all on function private.has_fer_role(text[]) from public,anon;
revoke all on function private.sync_auth_user_profile() from public,anon,authenticated;
revoke all on function private.touch_updated_at() from public,anon,authenticated;
revoke all on function private.protect_incident_owner() from public,anon,authenticated;
revoke all on function private.validate_incident_assignee() from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_fer_role(text[]) to authenticated;

drop trigger if exists auth_user_profile_created on auth.users;
create trigger auth_user_profile_created after insert on auth.users for each row execute function private.sync_auth_user_profile();
drop trigger if exists incidents_touch_updated_at on public.incidents;
create trigger incidents_touch_updated_at before update on public.incidents for each row execute function private.touch_updated_at();
drop trigger if exists incidents_protect_owner on public.incidents;
create trigger incidents_protect_owner before update on public.incidents for each row execute function private.protect_incident_owner();
drop trigger if exists incidents_validate_assignee on public.incidents;
create trigger incidents_validate_assignee before insert or update of assigned_to on public.incidents for each row execute function private.validate_incident_assignee();

alter table public.profiles enable row level security;
alter table public.incidents enable row level security;
alter table public.interventions enable row level security;
alter table public.assets enable row level security;
alter table public.payments enable row level security;
alter table public.resources enable row level security;
alter table public.incident_evidence enable row level security;

drop policy if exists incident_evidence_select_authorized on public.incident_evidence;
create policy incident_evidence_select_authorized on public.incident_evidence for select to authenticated
using(exists(
  select 1 from public.incidents incident where incident.id=incident_id
  and (incident.created_by=(select auth.uid()) or private.has_fer_role(array['direction','agent']))
));
drop policy if exists incident_evidence_insert_authorized on public.incident_evidence;
create policy incident_evidence_insert_authorized on public.incident_evidence for insert to authenticated
with check(uploaded_by=(select auth.uid()) and exists(
  select 1 from public.incidents incident where incident.id=incident_id
  and (incident.created_by=(select auth.uid()) or private.has_fer_role(array['direction','agent']))
));

drop policy if exists "profil personnel" on public.profiles;
drop policy if exists profiles_select_authorized on public.profiles;
create policy profiles_select_authorized on public.profiles for select to authenticated
using(
  id=(select auth.uid())
  or private.has_fer_role(array['direction'])
  or (private.has_fer_role(array['agent']) and role in ('direction','agent'))
);

drop policy if exists "personnel lit incidents" on public.incidents;
drop policy if exists "personnel crée incidents" on public.incidents;
drop policy if exists "auteur ou direction modifie incidents" on public.incidents;
drop policy if exists incidents_select_authorized on public.incidents;
drop policy if exists incidents_insert_authorized on public.incidents;
drop policy if exists staff_update_incidents on public.incidents;
drop policy if exists direction_delete_incidents on public.incidents;
create policy incidents_select_authorized on public.incidents for select to authenticated
using(created_by=(select auth.uid()) or private.has_fer_role(array['direction','agent']));
create policy incidents_insert_authorized on public.incidents for insert to authenticated with check(
  created_by=(select auth.uid()) and (
    (private.has_fer_role(array['direction','agent']) and source='FER') or
    (private.has_fer_role(array['user']) and source='FER' and status='À qualifier' and severity='Modérée' and assigned_to is null and client_request_id is not null and location_source in ('gps','manual_map') and location_captured_at is not null) or
    (private.has_fer_role(array['citoyen']) and source='Citoyen' and status='À qualifier' and severity='Modérée' and assigned_to is null and client_request_id is not null and location_source in ('gps','manual_map') and location_captured_at is not null)
  )
);
create policy staff_update_incidents on public.incidents for update to authenticated
using(private.has_fer_role(array['direction','agent'])) with check(private.has_fer_role(array['direction','agent']));
create policy direction_delete_incidents on public.incidents for delete to authenticated
using(private.has_fer_role(array['direction']));

drop policy if exists "personnel lit interventions" on public.interventions;
drop policy if exists "personnel crée interventions" on public.interventions;
drop policy if exists "auteur ou direction modifie interventions" on public.interventions;
drop policy if exists staff_update_interventions on public.interventions;
create policy "personnel lit interventions" on public.interventions for select to authenticated using(private.has_fer_role(array['direction','agent']));
create policy "personnel crée interventions" on public.interventions for insert to authenticated with check(created_by=(select auth.uid()) and private.has_fer_role(array['direction','agent']));
create policy staff_update_interventions on public.interventions for update to authenticated using(private.has_fer_role(array['direction']) or (created_by=(select auth.uid()) and private.has_fer_role(array['agent']))) with check(private.has_fer_role(array['direction']) or (created_by=(select auth.uid()) and private.has_fer_role(array['agent'])));

drop policy if exists "personnel lit patrimoine" on public.assets;
drop policy if exists "personnel crée patrimoine" on public.assets;
drop policy if exists "personnel modifie patrimoine" on public.assets;
create policy "personnel lit patrimoine" on public.assets for select to authenticated using(private.has_fer_role(array['direction','agent']));
create policy "personnel crée patrimoine" on public.assets for insert to authenticated with check(private.has_fer_role(array['direction','agent']));
create policy "personnel modifie patrimoine" on public.assets for update to authenticated using(private.has_fer_role(array['direction','agent'])) with check(private.has_fer_role(array['direction','agent']));

drop policy if exists "personnel lit finances" on public.payments;
drop policy if exists "direction gère paiements" on public.payments;
drop policy if exists direction_insert_payments on public.payments;
drop policy if exists direction_update_payments on public.payments;
drop policy if exists direction_delete_payments on public.payments;
create policy "personnel lit finances" on public.payments for select to authenticated using(private.has_fer_role(array['direction','agent']));
create policy direction_insert_payments on public.payments for insert to authenticated with check(private.has_fer_role(array['direction']));
create policy direction_update_payments on public.payments for update to authenticated using(private.has_fer_role(array['direction'])) with check(private.has_fer_role(array['direction']));
create policy direction_delete_payments on public.payments for delete to authenticated using(private.has_fer_role(array['direction']));
drop policy if exists "personnel lit ressources" on public.resources;
drop policy if exists "direction gère ressources" on public.resources;
drop policy if exists direction_insert_resources on public.resources;
drop policy if exists direction_update_resources on public.resources;
drop policy if exists direction_delete_resources on public.resources;
create policy "personnel lit ressources" on public.resources for select to authenticated using(private.has_fer_role(array['direction','agent']));
create policy direction_insert_resources on public.resources for insert to authenticated with check(private.has_fer_role(array['direction']));
create policy direction_update_resources on public.resources for update to authenticated using(private.has_fer_role(array['direction'])) with check(private.has_fer_role(array['direction']));
create policy direction_delete_resources on public.resources for delete to authenticated using(private.has_fer_role(array['direction']));

revoke all on public.profiles,public.incidents,public.interventions,public.assets,public.payments,public.resources,public.incident_evidence from anon,authenticated;
grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select,insert,update on public.interventions,public.assets to authenticated;
grant select,insert,update,delete on public.incidents to authenticated;
grant select,insert,update,delete on public.payments,public.resources to authenticated;
grant select,insert on public.incident_evidence to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('incident-evidence','incident-evidence',false,41943040,array['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/webm','video/quicktime','video/3gpp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists incident_evidence_storage_insert on storage.objects;
create policy incident_evidence_storage_insert on storage.objects for insert to authenticated
with check(
  bucket_id='incident-evidence'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.incidents incident where incident.id::text=(storage.foldername(name))[2]
    and (incident.created_by=(select auth.uid()) or private.has_fer_role(array['direction','agent'])))
);
drop policy if exists incident_evidence_storage_select on storage.objects;
create policy incident_evidence_storage_select on storage.objects for select to authenticated
using(
  bucket_id='incident-evidence'
  and (
    private.has_fer_role(array['direction'])
    or exists(select 1 from public.incidents incident where incident.id::text=(storage.foldername(name))[2]
      and (incident.created_by=(select auth.uid()) or private.has_fer_role(array['agent'])))
  )
);
drop policy if exists incident_evidence_storage_delete_direction on storage.objects;
create policy incident_evidence_storage_delete_direction on storage.objects for delete to authenticated
using(bucket_id='incident-evidence' and private.has_fer_role(array['direction']));
