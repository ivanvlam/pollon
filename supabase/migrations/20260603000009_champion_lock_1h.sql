-- ============================================================
-- Pollon — Campeón: cerrar 1h antes del primer partido (antes 24h)
-- ============================================================
-- Reemplaza submit_champion para usar 1 hora en vez de 24.

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
  v_lock_hours constant integer := 1;  -- antes 24
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
