-- Calcula puntos de goleador. Otorga 10 pts a cada usuario que acertó,
-- por cada polla en que participa. Idempotente.

create or replace function public.recalculate_top_scorer_scores(p_player_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_ids uuid[];
  v_rows     record;
  v_inserted int := 0;
begin
  select array_agg(user_id) into v_user_ids
  from public.top_scorer_predictions
  where player_name = p_player_name;

  delete from public.scores where reason = 'top_scorer';

  if v_user_ids is null then
    return json_build_object('inserted', 0);
  end if;

  for v_rows in
    select pm.user_id, pm.pool_id
    from public.pool_members pm
    where pm.user_id = any(v_user_ids)
  loop
    insert into public.scores (user_id, pool_id, match_id, points, reason)
    values (v_rows.user_id, v_rows.pool_id, null, 10, 'top_scorer');
    v_inserted := v_inserted + 1;
  end loop;

  return json_build_object('inserted', v_inserted);
end;
$$;

revoke execute on function public.recalculate_top_scorer_scores(text) from public, anon, authenticated;
grant execute on function public.recalculate_top_scorer_scores(text) to service_role;
