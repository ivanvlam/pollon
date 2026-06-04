-- ============================================================
-- Pollon — Partidos: cerrar 1h antes (antes 24h) + revelar predicciones
--           ajenas a esa misma hora, basado en TIEMPO (no en el flag).
-- ============================================================

-- 1) submit_prediction con ventana de 1 hora.
create or replace function public.submit_prediction(
  p_match_id        uuid,
  p_predicted_home  integer,
  p_predicted_away  integer,
  p_predicted_winner text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_match   public.matches%rowtype;
  v_pred_id uuid;
  v_lock_hours constant integer := 1;  -- antes 24
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'match not found';
  end if;

  if not v_match.is_active then
    raise exception 'match not active';
  end if;

  if now() >= v_match.kickoff_at - make_interval(hours => v_lock_hours) then
    raise exception 'predictions closed for this match';
  end if;

  if v_match.round = 'group_stage' then
    p_predicted_winner := null;
  end if;

  insert into public.predictions (
    user_id, match_id, predicted_home, predicted_away, predicted_winner
  )
  values (
    v_user, p_match_id, p_predicted_home, p_predicted_away, p_predicted_winner
  )
  on conflict (user_id, match_id) do update
    set predicted_home   = excluded.predicted_home,
        predicted_away   = excluded.predicted_away,
        predicted_winner = excluded.predicted_winner,
        updated_at       = now()
  returning id into v_pred_id;

  insert into public.prediction_history (
    prediction_id, predicted_home, predicted_away, predicted_winner
  )
  values (
    v_pred_id, p_predicted_home, p_predicted_away, p_predicted_winner
  );
end;
$$;

-- 2) Visibilidad de predicciones ajenas basada en TIEMPO (kickoff - 1h),
--    no en el flag is_locked. Así la revelación es inmediata y no depende
--    de cuándo corra el cron de bloqueo.
drop policy if exists "predictions_visibility" on public.predictions;

create policy "predictions_visibility" on public.predictions
  for select to authenticated
  using (
    user_id = auth.uid()
    or (
      public.shares_pool_with(user_id)
      and exists (
        select 1 from public.matches m
        where m.id = predictions.match_id
          and now() >= m.kickoff_at - make_interval(hours => 1)
      )
    )
  );
