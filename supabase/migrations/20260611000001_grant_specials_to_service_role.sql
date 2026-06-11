-- ============================================================
-- Pollon — GRANT faltante a service_role en tablas post-snapshot
-- ============================================================
-- grants.sql (20260603000008) concede acceso total a service_role con
-- "grant ... on all tables in schema public", pero eso es un SNAPSHOT de las
-- tablas existentes en ese momento. Las tablas creadas después NO quedaron
-- cubiertas (los default privileges automáticos de Supabase no aplicaron;
-- ver el comentario de 20260606000005_top_scorer_grants.sql).
--
-- Consecuencia: el panel admin lee estas tablas con el cliente service_role
-- (svc). Sin el GRANT, la query falla y el código la traga con `?? []`, así
-- que "Eligieron goleador" salía 0 y "Goleador más elegido" salía vacío,
-- mientras campeón (creada antes del snapshot) sí funcionaba.
--
-- Fix: conceder explícitamente los permisos a service_role en las tablas
-- post-snapshot que el admin/cron leen.

-- top_scorer_predictions (creada en 20260605000004, sin grant a service_role).
grant select, insert, update, delete on public.top_scorer_predictions to service_role;

-- players (creada en 20260605000004; 20260606000001 le dio iud pero no select).
grant select on public.players to service_role;
