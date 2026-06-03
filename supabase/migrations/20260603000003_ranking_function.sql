-- ============================================================
-- Pollon — Función de ranking de una polla
-- ============================================================
-- Devuelve el ranking ordenado con los desempates del CLAUDE.md:
--   1. total de puntos
--   2. resultados exactos
--   3. ganadores/clasificados acertados
--   4. campeón acertado
--   5. display_name (alfabético)
-- Incluye a todos los miembros, incluso con 0 puntos (left join).

create or replace function public.get_pool_ranking(p_pool_id uuid)
returns table (
  user_id          uuid,
  display_name     text,
  total            bigint,
  exact_count      bigint,
  winner_count     bigint,
  champion_correct boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Solo un miembro de la polla puede ver su ranking.
  if not public.is_pool_member(p_pool_id) then
    raise exception 'not authorized to view this ranking';
  end if;

  return query
    select
      pm.user_id,
      pr.display_name,
      coalesce(sum(s.points), 0)::bigint as total,
      count(*) filter (
        where s.reason in ('exact_score', 'exact_qualifier_score')
      )::bigint as exact_count,
      count(*) filter (
        where s.reason in ('correct_winner', 'correct_draw', 'correct_qualifier')
      )::bigint as winner_count,
      coalesce(bool_or(s.reason = 'champion'), false) as champion_correct
    from public.pool_members pm
    join public.profiles pr on pr.id = pm.user_id
    left join public.scores s
      on s.pool_id = pm.pool_id and s.user_id = pm.user_id
    where pm.pool_id = p_pool_id
    group by pm.user_id, pr.display_name
    order by
      total desc,
      exact_count desc,
      winner_count desc,
      champion_correct desc,
      pr.display_name asc;
end;
$$;
