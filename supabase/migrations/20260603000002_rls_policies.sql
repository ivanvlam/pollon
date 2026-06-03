-- ============================================================
-- Pollon — Row Level Security
-- ============================================================
-- Nota: las tablas escritas solo por el backend con SERVICE_ROLE_KEY
-- (matches, scores, prediction_history) no necesitan política de
-- escritura: el service role hace bypass de RLS. Sí definimos
-- políticas de SELECT para los clientes.

-- ------------------------------------------------------------
-- Helpers SECURITY DEFINER (evitan recursión infinita en RLS)
-- ------------------------------------------------------------

-- ¿auth.uid() es miembro de la polla dada?
create or replace function public.is_pool_member(p_pool_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.pool_members
    where pool_id = p_pool_id and user_id = auth.uid()
  );
$$;

-- ¿auth.uid() comparte al menos una polla con p_user_id?
create or replace function public.shares_pool_with(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.pool_members me
    join public.pool_members other on other.pool_id = me.pool_id
    where me.user_id = auth.uid()
      and other.user_id = p_user_id
  );
$$;

-- ============================================================
-- profiles
-- ============================================================
alter table public.profiles enable row level security;

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated
  using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================
-- pools
-- ============================================================
alter table public.pools enable row level security;

-- Ver pollas de las que soy miembro (o creador).
-- NO se expone ninguna otra polla: el flujo de "unirse por código" se
-- resuelve server-side con el service role (ver lib/pools/actions.ts),
-- así el invite_code permanece secreto y no es enumerable.
create policy "pools_select_member" on public.pools
  for select to authenticated
  using (created_by = auth.uid() or public.is_pool_member(id));

create policy "pools_insert_own" on public.pools
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "pools_update_creator" on public.pools
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "pools_delete_creator" on public.pools
  for delete to authenticated
  using (created_by = auth.uid());

-- ============================================================
-- pool_members
-- ============================================================
alter table public.pool_members enable row level security;

-- Veo el roster de las pollas a las que pertenezco
create policy "pool_members_select_same_pool" on public.pool_members
  for select to authenticated
  using (public.is_pool_member(pool_id));

-- Me uno a mí mismo a una polla
create policy "pool_members_insert_self" on public.pool_members
  for insert to authenticated
  with check (user_id = auth.uid());

-- Me salgo de una polla
create policy "pool_members_delete_self" on public.pool_members
  for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- matches  (lectura pública para autenticados; escritura solo service role)
-- ============================================================
alter table public.matches enable row level security;

create policy "matches_select_authenticated" on public.matches
  for select to authenticated
  using (true);

-- ============================================================
-- predictions  (política de visibilidad del CLAUDE.md)
-- ============================================================
alter table public.predictions enable row level security;

-- Veo mis predicciones siempre; las de compañeros de polla solo si el
-- partido ya está cerrado (is_locked = true).
create policy "predictions_visibility" on public.predictions
  for select to authenticated
  using (
    user_id = auth.uid()
    or (is_locked = true and public.shares_pool_with(user_id))
  );

create policy "predictions_insert_own" on public.predictions
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "predictions_update_own" on public.predictions
  for update to authenticated
  using (user_id = auth.uid() and is_locked = false)
  with check (user_id = auth.uid());

-- ============================================================
-- prediction_history  (solo lectura de la propia historia)
-- ============================================================
alter table public.prediction_history enable row level security;

create policy "prediction_history_select_own" on public.prediction_history
  for select to authenticated
  using (
    exists (
      select 1 from public.predictions p
      where p.id = prediction_history.prediction_id
        and p.user_id = auth.uid()
    )
  );

-- ============================================================
-- champion_predictions
-- ============================================================
alter table public.champion_predictions enable row level security;

-- Veo mi campeón siempre; el de otros solo si ya está bloqueado y comparto polla
create policy "champion_predictions_visibility" on public.champion_predictions
  for select to authenticated
  using (
    user_id = auth.uid()
    or (is_locked = true and public.shares_pool_with(user_id))
  );

create policy "champion_predictions_insert_own" on public.champion_predictions
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "champion_predictions_update_own" on public.champion_predictions
  for update to authenticated
  using (user_id = auth.uid() and is_locked = false)
  with check (user_id = auth.uid());

-- ============================================================
-- scores  (lectura para miembros de la polla; escritura solo service role)
-- ============================================================
alter table public.scores enable row level security;

create policy "scores_select_pool_member" on public.scores
  for select to authenticated
  using (public.is_pool_member(pool_id));
