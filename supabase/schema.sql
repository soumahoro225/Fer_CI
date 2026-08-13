-- FER SIG — schéma initial à exécuter dans l’éditeur SQL Supabase.
create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('direction','agent')),
  created_at timestamptz not null default now()
);

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(), reference text unique not null,
  title text not null, category text not null, location text not null,
  severity text not null default 'Modérée' check (severity in ('Critique','Élevée','Modérée')),
  status text not null default 'À qualifier', observations text, latitude double precision not null,
  longitude double precision not null, created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(), incident_id uuid references public.incidents(id),
  type text not null, contractor text not null, progress integer not null default 0 check(progress between 0 and 100),
  budget_fcfa bigint not null default 0, committed_fcfa bigint not null default 0,
  planned_start date, planned_end date, status text not null default 'Planifiée',
  created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
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

create or replace function private.has_fer_role(allowed_roles text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.role=any(allowed_roles)
  );
$$;
revoke all on function private.has_fer_role(text[]) from public;
grant usage on schema private to authenticated;
grant execute on function private.has_fer_role(text[]) to authenticated;

alter table public.profiles enable row level security;
alter table public.incidents enable row level security;
alter table public.interventions enable row level security;
alter table public.assets enable row level security;
alter table public.payments enable row level security;
alter table public.resources enable row level security;

create policy "profil personnel" on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy "personnel lit incidents" on public.incidents for select to authenticated using(private.has_fer_role(array['direction','agent']));
create policy "personnel crée incidents" on public.incidents for insert to authenticated with check(created_by=(select auth.uid()) and private.has_fer_role(array['direction','agent']));
create policy "auteur ou direction modifie incidents" on public.incidents for update to authenticated using(created_by=(select auth.uid()) or private.has_fer_role(array['direction'])) with check(created_by=(select auth.uid()) or private.has_fer_role(array['direction']));
create policy "personnel lit interventions" on public.interventions for select to authenticated using(private.has_fer_role(array['direction','agent']));
create policy "personnel crée interventions" on public.interventions for insert to authenticated with check(created_by=(select auth.uid()) and private.has_fer_role(array['direction','agent']));
create policy "auteur ou direction modifie interventions" on public.interventions for update to authenticated using(created_by=(select auth.uid()) or private.has_fer_role(array['direction'])) with check(created_by=(select auth.uid()) or private.has_fer_role(array['direction']));
create policy "personnel lit patrimoine" on public.assets for select to authenticated using(private.has_fer_role(array['direction','agent']));
create policy "personnel crée patrimoine" on public.assets for insert to authenticated with check(private.has_fer_role(array['direction','agent']));
create policy "personnel modifie patrimoine" on public.assets for update to authenticated using(private.has_fer_role(array['direction','agent'])) with check(private.has_fer_role(array['direction','agent']));
create policy "personnel lit finances" on public.payments for select to authenticated using(private.has_fer_role(array['direction','agent']));
create policy "direction gère paiements" on public.payments for all to authenticated using(private.has_fer_role(array['direction'])) with check(private.has_fer_role(array['direction']));
create policy "personnel lit ressources" on public.resources for select to authenticated using(private.has_fer_role(array['direction','agent']));
create policy "direction gère ressources" on public.resources for all to authenticated using(private.has_fer_role(array['direction'])) with check(private.has_fer_role(array['direction']));

grant select on public.profiles to authenticated;
grant select,insert,update on public.incidents,public.interventions,public.assets to authenticated;
grant select,insert,update,delete on public.payments,public.resources to authenticated;
