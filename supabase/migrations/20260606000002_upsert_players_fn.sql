-- Función SECURITY DEFINER para sincronizar jugadores sin requerir service role.
-- Corre como postgres (dueño de la tabla), cualquier usuario autenticado puede invocarla.
create or replace function public.upsert_players_data(players jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.players (name, team)
  select (p->>'name')::text, (p->>'team')::text
  from jsonb_array_elements(players) as p
  on conflict (name, team) do nothing;

  return (select count(*) from public.players)::integer;
end;
$$;

grant execute on function public.upsert_players_data(jsonb) to authenticated;
