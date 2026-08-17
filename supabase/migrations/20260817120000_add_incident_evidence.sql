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

create index if not exists incident_evidence_incident_created_idx
  on public.incident_evidence(incident_id, created_at);

alter table public.incident_evidence enable row level security;

drop policy if exists incident_evidence_select_authorized on public.incident_evidence;
create policy incident_evidence_select_authorized
on public.incident_evidence for select to authenticated
using (
  exists (
    select 1 from public.incidents incident
    where incident.id = incident_id
      and (
        incident.created_by = (select auth.uid())
        or private.has_fer_role(array['direction','agent'])
      )
  )
);

drop policy if exists incident_evidence_insert_authorized on public.incident_evidence;
create policy incident_evidence_insert_authorized
on public.incident_evidence for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1 from public.incidents incident
    where incident.id = incident_id
      and (
        incident.created_by = (select auth.uid())
        or private.has_fer_role(array['direction','agent'])
      )
  )
);

revoke all on public.incident_evidence from anon, authenticated;
grant select, insert on public.incident_evidence to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'incident-evidence',
  'incident-evidence',
  false,
  41943040,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/webm','video/quicktime','video/3gpp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists incident_evidence_storage_insert on storage.objects;
create policy incident_evidence_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'incident-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.incidents incident
    where incident.id::text = (storage.foldername(name))[2]
      and (
        incident.created_by = (select auth.uid())
        or private.has_fer_role(array['direction','agent'])
      )
  )
);

drop policy if exists incident_evidence_storage_select on storage.objects;
create policy incident_evidence_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'incident-evidence'
  and exists (
    select 1 from public.incidents incident
    where incident.id::text = (storage.foldername(name))[2]
      and (
        incident.created_by = (select auth.uid())
        or private.has_fer_role(array['direction','agent'])
      )
  )
);
