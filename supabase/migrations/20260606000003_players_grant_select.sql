-- Permite que usuarios autenticados y anónimos lean la tabla de jugadores.
-- La política RLS players_select (using true) ya existe, pero sin este grant
-- el motor de PostgreSQL deniega el acceso antes de evaluar RLS.
grant select on public.players to authenticated, anon;
