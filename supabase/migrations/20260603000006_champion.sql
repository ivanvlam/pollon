-- ============================================================
-- Pollon — Predicción de campeón
-- ============================================================

-- ------------------------------------------------------------
-- submit_champion: upsert de la predicción de campeón del usuario.
-- Cierra 24h antes del primer partido del torneo, o si ya está locked.
-- ------------------------------------------------------------
create or replace function public.submit_champion(p_team text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_first      timestamptz;
  v_locked     boolean;
  v_lock_hours constant integer := 24;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select is_locked into v_locked
  from public.champion_predictions
  where user_id = v_user;

  if v_locked then
    raise exception 'champion prediction closed';
  end if;

  select min(kickoff_at) into v_first from public.matches;
  if v_first is not null
     and now() >= v_first - make_interval(hours => v_lock_hours) then
    raise exception 'champion prediction closed';
  end if;

  insert into public.champion_predictions (user_id, team)
  values (v_user, p_team)
  on conflict (user_id) do update
    set team = excluded.team;
end;
$$;

-- ------------------------------------------------------------
-- replace_champion_scores: recálculo global e idempotente de los
-- puntos de campeón. Solo el service role.
-- ------------------------------------------------------------
create or replace function public.replace_champion_scores(p_scores jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.scores where reason = 'champion';

  insert into public.scores (user_id, pool_id, match_id, points, reason)
  select
    (e ->> 'user_id')::uuid,
    (e ->> 'pool_id')::uuid,
    null,
    (e ->> 'points')::integer,
    'champion'
  from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) as e;
end;
$$;

revoke execute on function public.replace_champion_scores(jsonb) from public;
revoke execute on function public.replace_champion_scores(jsonb) from anon, authenticated;
grant execute on function public.replace_champion_scores(jsonb) to service_role;
