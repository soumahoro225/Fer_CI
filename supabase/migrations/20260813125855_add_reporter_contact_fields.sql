begin;

alter table public.incidents add column if not exists reporter_first_name text;
alter table public.incidents add column if not exists reporter_last_name text;
alter table public.incidents add column if not exists reporter_phone text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'incidents_reporter_first_name_length_check'
      and conrelid = 'public.incidents'::regclass
  ) then
    alter table public.incidents
      add constraint incidents_reporter_first_name_length_check
      check (reporter_first_name is null or char_length(reporter_first_name) between 1 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'incidents_reporter_last_name_length_check'
      and conrelid = 'public.incidents'::regclass
  ) then
    alter table public.incidents
      add constraint incidents_reporter_last_name_length_check
      check (reporter_last_name is null or char_length(reporter_last_name) between 1 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'incidents_reporter_phone_format_check'
      and conrelid = 'public.incidents'::regclass
  ) then
    alter table public.incidents
      add constraint incidents_reporter_phone_format_check
      check (reporter_phone is null or reporter_phone ~ '^[+0-9][0-9 .()/-]{6,29}$');
  end if;
end
$$;

comment on column public.incidents.reporter_first_name is 'Prénom facultatif communiqué pour le suivi du signalement.';
comment on column public.incidents.reporter_last_name is 'Nom facultatif communiqué pour le suivi du signalement.';
comment on column public.incidents.reporter_phone is 'Téléphone facultatif communiqué pour le suivi du signalement.';

commit;
