-- La tabla players solo tenía política SELECT.
-- El service_role necesita GRANT explícito de escritura para el sync de jugadores.
grant insert, update, delete on public.players to service_role;
