-- Corrige get_my_pools_ranking: usa RANK() en vez de ROW_NUMBER() para que
-- los jugadores verdaderamente empatados (mismos 5 criterios) compartan el
-- mismo número de posición. display_name solo va en el ORDER BY final para
-- estabilizar el orden, no en la ventana.

create or replace function public.get_my_pools_ranking()
returns table (
  pool_id         uuid,
  pool_name       text,
  pool_created_by uuid,
  user_id         uuid,
  display_name    text,
  total           bigint,
  rank            bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with my_pools as (
    select p.id, p.name, p.created_by
    from public.pools p
    join public.pool_members pm on pm.pool_id = p.id
    where pm.user_id = auth.uid()
  ),
  scored as (
    select
      mp.id          as pool_id,
      mp.name        as pool_name,
      mp.created_by  as pool_created_by,
      pm.user_id,
      pr.display_name,
      coalesce(sum(s.points), 0)::bigint as total,
      count(*) filter (
        where s.reason in ('exact_score', 'exact_qualifier_score')
      )::bigint as exact_count,
      count(*) filter (
        where s.reason in ('correct_diff', 'correct_diff_qualifier')
      )::bigint as diff_count,
      count(*) filter (
        where s.reason in ('correct_winner', 'correct_draw', 'correct_qualifier')
      )::bigint as winner_count,
      coalesce(bool_or(s.reason = 'champion'), false) as champion_correct
    from my_pools mp
    join public.pool_members pm on pm.pool_id = mp.id
    join public.profiles pr on pr.id = pm.user_id
    left join public.scores s
      on s.pool_id = pm.pool_id and s.user_id = pm.user_id
    group by mp.id, mp.name, mp.created_by, pm.user_id, pr.display_name
  )
  select
    pool_id,
    pool_name,
    pool_created_by,
    user_id,
    display_name,
    total,
    rank() over (
      partition by pool_id
      order by
        total desc,
        exact_count desc,
        diff_count desc,
        winner_count desc,
        champion_correct desc
    )::bigint as rank
  from scored
  order by pool_id, rank, display_name asc;
$$;

grant execute on function public.get_my_pools_ranking() to authenticated;
