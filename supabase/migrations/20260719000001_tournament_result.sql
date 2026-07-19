-- ============================================================
-- Resultado final del torneo (singleton) — habilita el "Pollon Wrapped"
-- ============================================================
-- El Wrapped solo se activa cuando el torneo terminó del todo: campeón (se
-- deriva de la final ya finalizada) Y goleador (lo marca el admin a mano, y no
-- había dónde registrarlo). Esta tabla persiste el goleador real (y opcionalmente
-- el campeón) para poder gatear la vista.

create table if not exists public.tournament_result (
  id         boolean primary key default true,
  champion   text,
  top_scorer text,
  updated_at timestamptz not null default now(),
  constraint tournament_result_singleton check (id)
);

-- Fila única (singleton).
insert into public.tournament_result (id) values (true) on conflict (id) do nothing;

alter table public.tournament_result enable row level security;

-- Cualquier usuario autenticado puede leer el resultado (para el gate del Wrapped).
drop policy if exists tournament_result_select on public.tournament_result;
create policy tournament_result_select on public.tournament_result
  for select to authenticated using (true);

-- La escritura va solo por funciones SECURITY DEFINER (las ejecuta el service role).
create or replace function public.set_tournament_champion(p_champion text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tournament_result set champion = p_champion, updated_at = now() where id;
end;
$$;

create or replace function public.set_tournament_top_scorer(p_top_scorer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.tournament_result set top_scorer = p_top_scorer, updated_at = now() where id;
end;
$$;

revoke execute on function public.set_tournament_champion(text) from public, anon, authenticated;
grant execute on function public.set_tournament_champion(text) to service_role;
revoke execute on function public.set_tournament_top_scorer(text) from public, anon, authenticated;
grant execute on function public.set_tournament_top_scorer(text) to service_role;

-- ============================================================
-- Estadísticas globales del proyecto (para la slide de agradecimiento del
-- Wrapped). Van por SECURITY DEFINER porque son totales cruzando RLS.
-- ============================================================
create or replace function public.get_tournament_stats()
returns json
language sql
security definer
set search_path = public
stable
as $$
  select json_build_object(
    'predictions',      (select count(*) from public.predictions),
    'users',            (select count(*) from public.profiles),
    'pools',            (select count(*) from public.pools),
    'matches_finished', (select count(*) from public.matches where status = 'finished')
  );
$$;

grant execute on function public.get_tournament_stats() to authenticated, service_role;
