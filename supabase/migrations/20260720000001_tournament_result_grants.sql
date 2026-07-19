-- ============================================================
-- Fix: falta el GRANT de tabla en tournament_result
-- ============================================================
-- La migración anterior creó la RLS policy pero no el GRANT a nivel de
-- tabla — Postgres exige ambos. Sin el GRANT, cualquier lectura de
-- tournament_result devuelve "permission denied", getWrappedGate() lo traga
-- en silencio, y el Wrapped nunca se muestra aunque el goleador ya esté
-- marcado.

grant select on public.tournament_result to authenticated, service_role;
