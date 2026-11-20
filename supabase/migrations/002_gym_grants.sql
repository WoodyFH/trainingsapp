-- =============================================================================
-- Trainings-App: Zugriffsrechte nachtragen (Korrektur zu 001)
--
-- Nur nötig, wenn 001 bereits ausgeführt wurde und die App meldet
-- "permission denied for table gym_settings". Frische Installationen bekommen
-- diese Rechte schon aus 001. Das Skript berührt nur gym_-Tabellen und ist
-- wiederholbar.
-- =============================================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.gym_settings          to authenticated;
grant select, insert, update, delete on public.gym_exercises         to authenticated;
grant select, insert, update, delete on public.gym_templates         to authenticated;
grant select, insert, update, delete on public.gym_template_exercises to authenticated;
grant select, insert, update, delete on public.gym_cardio_types      to authenticated;
grant select, insert, update, delete on public.gym_sessions          to authenticated;
grant select, insert, update, delete on public.gym_exercise_logs     to authenticated;
grant select, insert, update, delete on public.gym_cardio_logs       to authenticated;
