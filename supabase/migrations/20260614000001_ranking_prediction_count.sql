-- Agrega prediction_count al ranking: partidos terminados donde el usuario hizo una predicción.

create or replace function public.get_pool_ranking(p_pool_id uuid)
returns table (
  user_id          uuid,
  display_name     text,
  total            bigint,
  exact_count      bigint,
  diff_count       bigint,
  winner_count     bigint,
  champion_correct boolean,
  prediction_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
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
        where s.reason in ('correct_diff', 'correct_diff_qualifier')
      )::bigint as diff_count,
      count(*) filter (
        where s.reason in ('correct_winner', 'correct_draw', 'correct_qualifier')
      )::bigint as winner_count,
      coalesce(bool_or(s.reason = 'champion'), false) as champion_correct,
      (
        select count(*)
        from public.predictions p2
        join public.matches m on m.id = p2.match_id
        where p2.user_id = pm.user_id
          and m.status = 'finished'
      )::bigint as prediction_count
    from public.pool_members pm
    join public.profiles pr on pr.id = pm.user_id
    left join public.scores s
      on s.pool_id = pm.pool_id and s.user_id = pm.user_id
    where pm.pool_id = p_pool_id
    group by pm.user_id, pr.display_name
    order by
      total desc,
      exact_count desc,
      diff_count desc,
      winner_count desc,
      champion_correct desc,
      pr.display_name asc;
end;
$$;
