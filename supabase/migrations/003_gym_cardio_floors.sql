-- =============================================================================
-- Trainings-App: Einheit "Etagen" für Cardio-Arten (Stairmaster)
--
-- * Erlaubt zusätzlich distance_unit = 'floors' in gym_cardio_types.
-- * Stellt die bereits angelegte Art "Stairmaster" von km auf Etagen um.
--   Schon eingetragene Stairmaster-Werte bleiben als Zahl erhalten und werden
--   künftig als Etagen gelesen.
--
-- Bitte VOR dem Öffnen der neuen App-Version im SQL-Editor ausführen.
-- Das Skript berührt nur gym_-Tabellen und ist wiederholbar.
-- =============================================================================

alter table public.gym_cardio_types
  drop constraint if exists gym_cardio_types_distance_unit_check;

alter table public.gym_cardio_types
  add constraint gym_cardio_types_distance_unit_check
  check (distance_unit in ('km', 'm', 'floors'));

update public.gym_cardio_types
   set distance_unit = 'floors',
       updated_at    = now()
 where name = 'Stairmaster'
   and distance_unit = 'km';
