-- ============================================================
-- Pollon — Revelar campeón/goleador por TIEMPO (1h antes del primer partido)
-- ============================================================
-- Antes: los picks ajenos de campeón se revelaban con is_locked = true (lo
-- setea el cron horario → podía atrasarse hasta 1h respecto al cierre real),
-- y el goleador ajeno NO se revelaba nunca (faltaba la policy).
--
-- Ahora ambos se revelan a compañeros de polla exactamente 1h antes del
-- primer partido del torneo (mismo umbral que su cierre: submit_champion /
-- isChampionLocked), calculado por tiempo y sin depender del cron. Coincide
-- con la revelación de las predicciones de partido (también por tiempo).

-- Helper: ¿ya se pueden revelar las apuestas especiales? (1h antes del primer
-- kickoff del torneo). SECURITY DEFINER para leer min(kickoff_at) sin fricción
-- de RLS. Si aún no hay fixture, devuelve false (no revelado).
create or replace function public.specials_revealed()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    now() >= (select min(kickoff_at) from public.matches) - make_interval(hours => 1),
    false
  );
$$;

grant execute on function public.specials_revealed() to authenticated;

-- champion_predictions: propio siempre; ajeno si comparto polla y ya se revela.
drop policy if exists "champion_predictions_visibility" on public.champion_predictions;

create policy "champion_predictions_visibility" on public.champion_predictions
  for select to authenticated
  using (
    user_id = auth.uid()
    or (public.shares_pool_with(user_id) and public.specials_revealed())
  );

-- top_scorer_predictions: reemplaza select_own por la misma visibilidad que
-- campeón (propio siempre; ajeno si comparto polla y ya se revela).
drop policy if exists "top_scorer_select_own" on public.top_scorer_predictions;

create policy "top_scorer_predictions_visibility" on public.top_scorer_predictions
  for select to authenticated
  using (
    user_id = auth.uid()
    or (public.shares_pool_with(user_id) and public.specials_revealed())
  );
