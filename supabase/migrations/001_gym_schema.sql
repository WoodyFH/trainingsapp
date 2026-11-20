-- =============================================================================
-- Trainings-App: Schema (Phase 2)
--
-- Im Supabase-SQL-Editor ausführen. Das Skript legt NUR Objekte mit dem Präfix
-- "gym_" an. Tabellen ohne dieses Präfix (Habit Tracker) werden weder gelesen
-- noch verändert. Es ist wiederholbar (idempotent): ein zweiter Lauf ändert
-- nichts an vorhandenen Daten.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table if not exists public.gym_settings (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  bodyweight_kg     numeric not null default 75 check (bodyweight_kg > 0),
  updated_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.gym_exercises (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null,
  short_name        text,
  load_type         text not null check (load_type in ('weight', 'assisted', 'bodyweight', 'time')),
  primary_muscles   text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  weight_step       numeric not null default 5 check (weight_step > 0),
  notes             text,
  sides             smallint not null default 1 check (sides in (1, 2)),
  archived          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  constraint gym_exercises_muscles_valid check (
    primary_muscles <@ array['shoulders','chest','biceps','abs','obliques','quads','adductors',
                             'upper_back','triceps','lower_back','glutes','hamstrings','calves']::text[]
    and secondary_muscles <@ array['shoulders','chest','biceps','abs','obliques','quads','adductors',
                                   'upper_back','triceps','lower_back','glutes','hamstrings','calves']::text[]
  )
);

create table if not exists public.gym_templates (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null,
  color             text not null default '#F04E5E',
  icon              text not null default 'Dumbbell',
  in_rotation       boolean not null default false,
  rotation_order    integer,
  sort              integer not null default 0,
  archived          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.gym_template_exercises (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id       uuid not null references public.gym_templates (id),
  exercise_id       uuid not null references public.gym_exercises (id),
  sort              integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.gym_cardio_types (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name              text not null,
  icon              text not null default 'Activity',
  distance_unit     text not null default 'km' check (distance_unit in ('km', 'm')),
  sort              integer not null default 0,
  archived          boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.gym_sessions (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind              text not null check (kind in ('strength', 'free', 'cardio')),
  template_id       uuid references public.gym_templates (id),
  date              date not null,
  started_at        timestamptz,
  finished_at       timestamptz,
  note              text,
  source            text not null default 'app' check (source in ('app', 'import')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.gym_exercise_logs (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id        uuid not null references public.gym_sessions (id),
  exercise_id       uuid not null references public.gym_exercises (id),
  sets              integer not null check (sets > 0),
  reps              integer check (reps is null or reps >= 0),
  weight_kg         numeric,
  seconds           integer check (seconds is null or seconds >= 0),
  sides             smallint not null default 1 check (sides in (1, 2)),
  increase_next     boolean not null default false,
  note              text,
  sort              integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.gym_cardio_logs (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id        uuid not null references public.gym_sessions (id),
  cardio_type_id    uuid not null references public.gym_cardio_types (id),
  duration_min      numeric check (duration_min is null or duration_min >= 0),
  kcal              integer check (kcal is null or kcal >= 0),
  avg_hr            integer check (avg_hr is null or avg_hr >= 0),
  distance          numeric check (distance is null or distance >= 0),
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  server_updated_at timestamptz not null default clock_timestamp(),
  constraint gym_cardio_logs_has_value check (
    duration_min is not null or kcal is not null or avg_hr is not null or distance is not null
  )
);

-- ---------------------------------------------------------------------------
-- Indizes
-- ---------------------------------------------------------------------------

create index if not exists gym_exercises_sync_idx          on public.gym_exercises (server_updated_at);
create index if not exists gym_templates_sync_idx          on public.gym_templates (server_updated_at);
create index if not exists gym_template_exercises_sync_idx on public.gym_template_exercises (server_updated_at);
create index if not exists gym_template_exercises_tpl_idx  on public.gym_template_exercises (template_id);
create index if not exists gym_cardio_types_sync_idx       on public.gym_cardio_types (server_updated_at);
create index if not exists gym_sessions_sync_idx           on public.gym_sessions (server_updated_at);
create index if not exists gym_sessions_date_idx           on public.gym_sessions (user_id, date);
create index if not exists gym_exercise_logs_sync_idx      on public.gym_exercise_logs (server_updated_at);
create index if not exists gym_exercise_logs_session_idx   on public.gym_exercise_logs (session_id);
create index if not exists gym_exercise_logs_exercise_idx  on public.gym_exercise_logs (exercise_id);
create index if not exists gym_cardio_logs_sync_idx        on public.gym_cardio_logs (server_updated_at);
create index if not exists gym_cardio_logs_session_idx     on public.gym_cardio_logs (session_id);
create index if not exists gym_settings_sync_idx           on public.gym_settings (server_updated_at);

-- ---------------------------------------------------------------------------
-- Trigger: "Letzte Änderung gewinnt" und serverseitiger Sync-Zeitstempel
--
-- * Ein Update mit älterem updated_at als der gespeicherte Stand wird verworfen
--   (bei upsert ohne Fehlermeldung), damit späte Offline-Änderungen keine
--   neueren Daten überschreiben.
-- * server_updated_at wird bei jedem Schreiben vom Server gesetzt. Geräte
--   holen Änderungen anhand dieses Zeitstempels und sind damit unabhängig von
--   ihrer eigenen Uhr.
-- ---------------------------------------------------------------------------

create or replace function public.gym_before_write()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null;
    end if;
    new.user_id := old.user_id;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trigger und Row Level Security für alle gym_-Tabellen
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'gym_settings', 'gym_exercises', 'gym_templates', 'gym_template_exercises',
    'gym_cardio_types', 'gym_sessions', 'gym_exercise_logs', 'gym_cardio_logs'
  ]
  loop
    execute format('drop trigger if exists %I on public.%I', t || '_before_write', t);
    execute format(
      'create trigger %I before insert or update on public.%I
         for each row execute function public.gym_before_write()',
      t || '_before_write', t
    );

    execute format('alter table public.%I enable row level security', t);

    -- Zugriffsrechte auf Tabellenebene. Neuere Supabase-Projekte vergeben sie für selbst
    -- angelegte Tabellen nicht mehr automatisch (Fehler "permission denied for table ...").
    -- Welche Zeilen sichtbar sind, regeln weiterhin die RLS-Policies unten.
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (user_id = (select auth.uid()))',
      t || '_select', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (user_id = (select auth.uid()))',
      t || '_insert', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_update', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (user_id = (select auth.uid()))',
      t || '_delete', t
    );
  end loop;
end;
$$;
