-- ============================================================
-- Pollon — replace_user_pool_scores (backfill atómico)
-- ============================================================
-- Borra los scores de partido de un usuario en una polla y los reinserta
-- desde cero en una sola transacción. Solo el service role puede ejecutarla.
-- Los puntos se calculan en TypeScript (scoring.ts) y se pasan como JSON.

create or replace function public.replace_user_pool_scores(
  p_user_id  uuid,
  p_pool_id  uuid,
  p_scores   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Solo scores de partido (match_id IS NOT NULL); no toca campeón ni goleador.
  delete from public.scores
  where user_id = p_user_id
    and pool_id = p_pool_id
    and match_id is not null;

  insert into public.scores (user_id, pool_id, match_id, points, reason)
  select
    p_user_id,
    p_pool_id,
    (e ->> 'match_id')::uuid,
    (e ->> 'points')::integer,
    e ->> 'reason'
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as e;
end;
$$;

revoke execute on function public.replace_user_pool_scores(uuid, uuid, jsonb) from public;
revoke execute on function public.replace_user_pool_scores(uuid, uuid, jsonb) from anon, authenticated;
grant execute on function public.replace_user_pool_scores(uuid, uuid, jsonb) to service_role;
