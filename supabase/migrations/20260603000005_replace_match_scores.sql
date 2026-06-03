-- ============================================================
-- Pollon — replace_match_scores (recálculo atómico)
-- ============================================================
-- Borra los scores de un partido y los reinserta desde cero en una
-- sola transacción. Los puntos se calculan en TypeScript (scoring.ts)
-- y se pasan como JSON. Solo el service role puede ejecutarla.

create or replace function public.replace_match_scores(
  p_match_id uuid,
  p_scores   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.scores where match_id = p_match_id;

  insert into public.scores (user_id, pool_id, match_id, points, reason)
  select
    (e ->> 'user_id')::uuid,
    (e ->> 'pool_id')::uuid,
    p_match_id,
    (e ->> 'points')::integer,
    e ->> 'reason'
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as e;
end;
$$;

-- Bloquear la ejecución a clientes normales: solo el service role.
revoke execute on function public.replace_match_scores(uuid, jsonb) from public;
revoke execute on function public.replace_match_scores(uuid, jsonb) from anon, authenticated;
-- Tras revocar PUBLIC hay que conceder explícitamente al service role,
-- que es quien la invoca desde el cron / panel admin.
grant execute on function public.replace_match_scores(uuid, jsonb) to service_role;
