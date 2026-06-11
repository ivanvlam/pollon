-- ============================================================
-- Pollon — Extender cierre de campeón/goleador a kickoff + 2h
-- ============================================================
-- Antes: campeón/goleador cerraban 1h ANTES del primer partido. Se extiende a
-- 2h DESPUÉS del inicio del primer partido (lock_hours pasa de 1 a -2; negativo
-- = después del kickoff). Debe coincidir con CHAMPION_LOCK_HOURS en
-- constants.ts (frontend + cron lock-predictions) y con specials_revealed.
--
-- Fairness: la revelación de los picks ajenos (specials_revealed) se mueve al
-- MISMO instante que el cierre (kickoff + 2h), para que nadie vea el campeón/
-- goleador de otros mientras todavía puede elegir el suyo.

-- 1) submit_champion: cierre a kickoff + 2h (v_lock_hours = -2).
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
  v_lock_hours constant integer := -2;  -- negativo = después del kickoff
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_in_any_pool() then
    raise exception 'no pool';
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

-- 2) specials_revealed: revelar recién en el nuevo cierre (kickoff + 2h).
create or replace function public.specials_revealed()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    now() >= (select min(kickoff_at) from public.matches) + make_interval(hours => 2),
    false
  );
$$;

-- 3) Reabrir picks que el cron pudo haber bloqueado con el umbral viejo
-- (1h antes). Sin esto, el guard v_locked de submit_champion y las policies de
-- update RLS (not is_locked) seguirían bloqueando la edición. El cron volverá a
-- bloquear correctamente al nuevo cierre (kickoff + 2h).
update public.champion_predictions set is_locked = false, locked_at = null
where is_locked = true;

update public.top_scorer_predictions set is_locked = false, locked_at = null
where is_locked = true;
