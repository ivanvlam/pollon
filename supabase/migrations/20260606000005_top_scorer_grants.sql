-- top_scorer_predictions fue creada después del GRANT global (grants.sql),
-- así que authenticated no heredó los permisos. Grant explícito necesario.
grant select, insert, update on public.top_scorer_predictions to authenticated;
