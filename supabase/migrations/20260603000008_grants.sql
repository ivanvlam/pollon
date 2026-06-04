-- ============================================================
-- Pollon — Privilegios de rol (Supabase)
-- ============================================================
-- Las tablas necesitan GRANT explícito además de las políticas RLS.
-- (Si el proyecto Supabase no aplicó los default privileges automáticos,
-- sin esto PostgREST devuelve "permission denied for table".)
--
-- Modelo: las políticas RLS ya filtran las filas; el GRANT habilita la
-- operación a nivel de tabla. anon no recibe nada (todos los flujos
-- requieren sesión). service_role hace bypass de RLS (cron/admin).

grant usage on schema public to anon, authenticated, service_role;

-- service_role: acceso total a las tablas (lo usan cron y panel admin).
grant select, insert, update, delete
  on all tables in schema public
  to service_role;

-- authenticated: DML; las políticas RLS deciden qué filas ve/escribe.
grant select, insert, update, delete
  on all tables in schema public
  to authenticated;

-- Nota: NO se tocan los privilegios EXECUTE de funciones. replace_match_scores
-- y replace_champion_scores siguen revocadas a anon/authenticated y
-- concedidas solo a service_role (ver sus migraciones).
