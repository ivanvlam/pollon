-- ===== 20260603000001_initial_schema.sql =====
-- ============================================================
-- Pollon — Schema inicial
-- Mundial 2026. Tablas en orden de dependencias de FK.
-- ============================================================

-- Extensiones necesarias (gen_random_uuid ya viene en pgcrypto/pg15)
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- profiles  (extiende auth.users)
-- ------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  timezone     text,                       -- detectada en el browser con Intl.DateTimeFormat
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- pools
-- ------------------------------------------------------------
create table public.pools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid not null references auth.users (id) on delete cascade,
  invite_code text unique not null,         -- generado con nanoid en la app
  created_at  timestamptz not null default now()
);

create index pools_created_by_idx on public.pools (created_by);

-- ------------------------------------------------------------
-- pool_members
-- ------------------------------------------------------------
create table public.pool_members (
  id        uuid primary key default gen_random_uuid(),
  pool_id   uuid not null references public.pools (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (pool_id, user_id)
);

create index pool_members_pool_id_idx on public.pool_members (pool_id);
create index pool_members_user_id_idx on public.pool_members (user_id);

-- ------------------------------------------------------------
-- matches
-- ------------------------------------------------------------
create table public.matches (
  id          uuid primary key default gen_random_uuid(),
  external_id text unique not null,          -- id de API-Football
  round       text not null,                 -- group_stage | round_of_16 | quarterfinal | semifinal | final
  group_name  text,                          -- solo fase de grupos, ej. 'Group A'
  home_team   text not null,
  away_team   text not null,
  kickoff_at  timestamptz not null,          -- SIEMPRE en UTC
  status      text not null default 'scheduled', -- scheduled | live | finished
  home_score  integer,                       -- resultado a los 90 min
  away_score  integer,                       -- resultado a los 90 min
  winner      text,                          -- 'home' | 'away' (eliminatorias: quien clasifica)
  is_active   boolean not null default false,-- true cuando la ronda está habilitada
  updated_at  timestamptz not null default now(),
  constraint matches_round_check check (
    round in ('group_stage','round_of_16','quarterfinal','semifinal','final')
  ),
  constraint matches_status_check check (status in ('scheduled','live','finished')),
  constraint matches_winner_check check (winner is null or winner in ('home','away'))
);

create index matches_kickoff_at_idx on public.matches (kickoff_at);
create index matches_status_idx on public.matches (status);

-- ------------------------------------------------------------
-- predictions  (una por usuario por partido, transversal a todas sus pollas)
-- ------------------------------------------------------------
create table public.predictions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  match_id         uuid not null references public.matches (id) on delete cascade,
  predicted_home   integer,
  predicted_away   integer,
  predicted_winner text,                     -- 'home' | 'away', solo eliminatorias
  is_locked        boolean not null default false,
  locked_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, match_id),
  constraint predictions_winner_check check (
    predicted_winner is null or predicted_winner in ('home','away')
  )
);

create index predictions_match_id_idx on public.predictions (match_id);
create index predictions_user_id_idx on public.predictions (user_id);

-- ------------------------------------------------------------
-- prediction_history
-- ------------------------------------------------------------
create table public.prediction_history (
  id               uuid primary key default gen_random_uuid(),
  prediction_id    uuid not null references public.predictions (id) on delete cascade,
  predicted_home   integer,
  predicted_away   integer,
  predicted_winner text,
  changed_at       timestamptz not null default now()
);

create index prediction_history_prediction_id_idx on public.prediction_history (prediction_id);

-- ------------------------------------------------------------
-- champion_predictions  (un campeón por usuario)
-- ------------------------------------------------------------
create table public.champion_predictions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  team       text not null,
  is_locked  boolean not null default false,
  locked_at  timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- scores  (puntos calculados explícitamente al finalizar partido)
-- ------------------------------------------------------------
create table public.scores (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  pool_id       uuid not null references public.pools (id) on delete cascade,
  match_id      uuid references public.matches (id) on delete cascade, -- null si es por campeón
  points        integer not null,
  reason        text not null,  -- exact_score | correct_winner | correct_draw | correct_qualifier | exact_qualifier_score | champion
  calculated_at timestamptz not null default now(),
  unique (user_id, pool_id, match_id),
  constraint scores_reason_check check (
    reason in ('exact_score','correct_winner','correct_draw','correct_qualifier','exact_qualifier_score','champion')
  )
);

create index scores_pool_id_idx on public.scores (pool_id);
create index scores_user_id_idx on public.scores (user_id);
create index scores_match_id_idx on public.scores (match_id);

-- ------------------------------------------------------------
-- Triggers: updated_at automático
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

create trigger predictions_set_updated_at
  before update on public.predictions
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Trigger: crear profile automáticamente al registrarse
-- display_name viene en raw_user_meta_data.display_name
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ===== 20260603000002_rls_policies.sql =====
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


-- ===== 20260603000003_ranking_function.sql =====
-- ============================================================
-- Pollon — Función de ranking de una polla
-- ============================================================
-- Devuelve el ranking ordenado con los desempates del CLAUDE.md:
--   1. total de puntos
--   2. resultados exactos
--   3. ganadores/clasificados acertados
--   4. campeón acertado
--   5. display_name (alfabético)
-- Incluye a todos los miembros, incluso con 0 puntos (left join).

create or replace function public.get_pool_ranking(p_pool_id uuid)
returns table (
  user_id          uuid,
  display_name     text,
  total            bigint,
  exact_count      bigint,
  winner_count     bigint,
  champion_correct boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Solo un miembro de la polla puede ver su ranking.
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
        where s.reason in ('correct_winner', 'correct_draw', 'correct_qualifier')
      )::bigint as winner_count,
      coalesce(bool_or(s.reason = 'champion'), false) as champion_correct
    from public.pool_members pm
    join public.profiles pr on pr.id = pm.user_id
    left join public.scores s
      on s.pool_id = pm.pool_id and s.user_id = pm.user_id
    where pm.pool_id = p_pool_id
    group by pm.user_id, pr.display_name
    order by
      total desc,
      exact_count desc,
      winner_count desc,
      champion_correct desc,
      pr.display_name asc;
end;
$$;


-- ===== 20260603000004_submit_prediction.sql =====
-- ============================================================
-- Pollon — submit_prediction (upsert + historial atómico)
-- ============================================================
-- Una función = una transacción. Hace:
--   1. valida que el partido exista, esté activo y no haya cerrado (24h antes del kickoff)
--   2. upsert en predictions
--   3. insert en prediction_history
-- Corre como SECURITY DEFINER pero fuerza user_id = auth.uid().

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
  v_lock_hours constant integer := 24;
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

  -- winner solo aplica a eliminatorias
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


-- ===== 20260603000005_replace_match_scores.sql =====
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


-- ===== 20260603000006_champion.sql =====
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


-- ===== 20260603000007_sent_reminders.sql =====
-- ============================================================
-- Pollon — Registro de recordatorios enviados (idempotencia)
-- ============================================================
-- Evita emails duplicados: send-reminders corre cada hora y la ventana
-- de aviso es de 2h, así que un mismo (usuario, partido) cae en dos
-- corridas consecutivas. El UNIQUE actúa de candado.

create table public.sent_reminders (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users (id) on delete cascade,
  match_id  uuid not null references public.matches (id) on delete cascade,
  sent_at   timestamptz not null default now(),
  unique (user_id, match_id)
);

create index sent_reminders_match_id_idx on public.sent_reminders (match_id);

-- RLS activada sin políticas: ningún cliente (anon/authenticated) puede
-- leer ni escribir. Solo el service role (cron) accede, haciendo bypass.
alter table public.sent_reminders enable row level security;


-- ===== 20260603000008_grants.sql =====
-- ============================================================
-- Pollon — Privilegios de rol (Supabase)
-- ============================================================
-- Las tablas necesitan GRANT explícito además de las políticas RLS.
-- (Si el proyecto Supabase no aplicó los default privileges automáticos,
-- sin esto PostgREST devuelve "permission denied for table".)
--
-- Modelo: las políticas RLS ya filtran las filas; el GRANT habilita la
-- operación a nivel de tabla. anon no recibe nada (todos los flujos
-- requieren sesión). service_role hace bypass de RLS (cron/admin).

grant usage on schema public to anon, authenticated, service_role;

-- service_role: acceso total a las tablas (lo usan cron y panel admin).
grant select, insert, update, delete
  on all tables in schema public
  to service_role;

-- authenticated: DML; las políticas RLS deciden qué filas ve/escribe.
grant select, insert, update, delete
  on all tables in schema public
  to authenticated;

-- Nota: NO se tocan los privilegios EXECUTE de funciones. replace_match_scores
-- y replace_champion_scores siguen revocadas a anon/authenticated y
-- concedidas solo a service_role (ver sus migraciones).


-- ===== 20260603000009_champion_lock_1h.sql =====
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


-- ===== 20260603000010_match_lock_1h.sql =====
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


-- ===== 20260605000001_add_round_of_32.sql =====
-- Mundial 2026 tiene 48 equipos → nueva ronda de 32 antes de octavos.
alter table matches
  drop constraint matches_round_check,
  add constraint matches_round_check check (
    round in ('group_stage','round_of_32','round_of_16','quarterfinal','semifinal','final')
  );


-- ===== 20260605000002_lock_at_kickoff.sql =====
-- Las predicciones cierran exactamente al inicio del partido (antes cerraban 1h antes).
-- También actualiza la política de visibilidad de predicciones ajenas.

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

  if now() >= v_match.kickoff_at then
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

-- Predicciones ajenas se revelan al inicio del partido.
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
          and now() >= m.kickoff_at
      )
    )
  );


-- ===== 20260605000003_update_ranking_new_scoring.sql =====
-- Actualiza get_pool_ranking para el nuevo sistema de puntos.
-- Agrega diff_count (aciertos de 3 pts) como nuevo nivel de desempate.
-- Desempate: total → exact_count (5pts) → diff_count (3pts) → winner_count (2pts) → campeón → nombre.

create or replace function public.get_pool_ranking(p_pool_id uuid)
returns table (
  user_id          uuid,
  display_name     text,
  total            bigint,
  exact_count      bigint,
  diff_count       bigint,
  winner_count     bigint,
  champion_correct boolean
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
      coalesce(bool_or(s.reason = 'champion'), false) as champion_correct
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


-- ===== 20260605000004_players_top_scorer.sql =====
-- Jugadores para el dropdown del goleador
create table public.players (
  id   uuid primary key default gen_random_uuid(),
  name text not null,
  team text not null,
  unique (name, team)
);

alter table public.players enable row level security;
create policy "players_select" on public.players for select using (true);

-- Predicciones de goleador (una por usuario, igual que campeón)
create table public.top_scorer_predictions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  player_name text not null,
  is_locked   boolean not null default false,
  locked_at   timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id)
);

alter table public.top_scorer_predictions enable row level security;

create policy "top_scorer_select_own" on public.top_scorer_predictions
  for select using (user_id = auth.uid());

create policy "top_scorer_insert_own" on public.top_scorer_predictions
  for insert with check (user_id = auth.uid() and not is_locked);

create policy "top_scorer_update_own" on public.top_scorer_predictions
  for update using (user_id = auth.uid() and not is_locked);


-- ===== 20260605000005_top_scorer_scoring.sql =====
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


-- ===== 20260606000001_players_grant_write.sql =====
-- La tabla players solo tenía política SELECT.
-- El service_role necesita GRANT explícito de escritura para el sync de jugadores.
grant insert, update, delete on public.players to service_role;


-- ===== 20260606000002_upsert_players_fn.sql =====
-- Función SECURITY DEFINER para sincronizar jugadores sin requerir service role.
-- Corre como postgres (dueño de la tabla), cualquier usuario autenticado puede invocarla.
create or replace function public.upsert_players_data(players jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.players (name, team)
  select (p->>'name')::text, (p->>'team')::text
  from jsonb_array_elements(players) as p
  on conflict (name, team) do nothing;

  return (select count(*) from public.players)::integer;
end;
$$;

grant execute on function public.upsert_players_data(jsonb) to authenticated;


-- ===== 20260606000003_players_grant_select.sql =====
-- Permite que usuarios autenticados y anónimos lean la tabla de jugadores.
-- La política RLS players_select (using true) ya existe, pero sin este grant
-- el motor de PostgreSQL deniega el acceso antes de evaluar RLS.
grant select on public.players to authenticated, anon;


-- ===== 20260606000004_join_pool_fn.sql =====
-- Función SECURITY DEFINER para unirse a una polla por invite_code.
-- El client anon/authenticated no puede hacer SELECT en pools ajenas (RLS),
-- pero esta función corre como el owner (definer) y sí puede.
create or replace function public.join_pool_by_code(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool_id uuid;
begin
  select id into v_pool_id
  from public.pools
  where invite_code = p_invite_code;

  if v_pool_id is null then
    return null;
  end if;

  insert into public.pool_members (pool_id, user_id)
  values (v_pool_id, auth.uid())
  on conflict (pool_id, user_id) do nothing;

  return v_pool_id;
end;
$$;

grant execute on function public.join_pool_by_code(text) to authenticated;


-- ===== 20260606000005_top_scorer_grants.sql =====
-- top_scorer_predictions fue creada después del GRANT global (grants.sql),
-- así que authenticated no heredó los permisos. Grant explícito necesario.
grant select, insert, update on public.top_scorer_predictions to authenticated;


-- ===== 20260606000006_lock_1h_before_each_match.sql =====
-- ============================================================
-- Pollon — Cierre de predicciones: 1h antes de CADA partido
-- ============================================================
-- Contexto: la migración 20260605000002_lock_at_kickoff cambió el cierre
-- a "exactamente al kickoff" (0h). Esto restaura el comportamiento
-- deseado: cada partido cierra 1 hora antes de SU propio kickoff_at, y
-- las predicciones ajenas se revelan a esa misma hora.
--
-- El cierre es por partido (kickoff_at de cada uno), NO global. La
-- predicción de campeón y goleador se cierra 1h antes del PRIMER partido
-- del torneo y se maneja aparte (submit_champion / isChampionLocked).
--
-- Debe coincidir con LOCK_HOURS_BEFORE_KICKOFF = 1 en src/lib/constants.ts.

-- 1) submit_prediction: rechazar a partir de kickoff - 1h.
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
  v_lock_hours constant integer := 1;  -- 1h antes de cada partido
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
--    no en el flag is_locked. Así la revelación es inmediata y coincide
--    exactamente con el momento de cierre, sin depender del cron.
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


-- ===== 20260606000007_dashboard_and_delete_rpcs.sql =====
-- ============================================================
-- Pollon — RPCs: dashboard (1 sola query) + borrado atómico de polla
-- ============================================================

-- ------------------------------------------------------------
-- get_my_pools_ranking: ranking de TODAS las pollas del usuario en una
-- sola llamada (elimina el N+1 del dashboard). Devuelve una fila por
-- (polla, miembro) ya ordenada por posición, con metadata de la polla.
-- Solo expone pollas donde auth.uid() es miembro.
-- ------------------------------------------------------------
create or replace function public.get_my_pools_ranking()
returns table (
  pool_id         uuid,
  pool_name       text,
  pool_created_by uuid,
  user_id         uuid,
  display_name    text,
  total           bigint,
  rank            bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with my_pools as (
    select p.id, p.name, p.created_by
    from public.pools p
    join public.pool_members pm on pm.pool_id = p.id
    where pm.user_id = auth.uid()
  ),
  scored as (
    select
      mp.id          as pool_id,
      mp.name        as pool_name,
      mp.created_by  as pool_created_by,
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
      coalesce(bool_or(s.reason = 'champion'), false) as champion_correct
    from my_pools mp
    join public.pool_members pm on pm.pool_id = mp.id
    join public.profiles pr on pr.id = pm.user_id
    left join public.scores s
      on s.pool_id = pm.pool_id and s.user_id = pm.user_id
    group by mp.id, mp.name, mp.created_by, pm.user_id, pr.display_name
  )
  select
    pool_id,
    pool_name,
    pool_created_by,
    user_id,
    display_name,
    total,
    row_number() over (
      partition by pool_id
      order by
        total desc,
        exact_count desc,
        diff_count desc,
        winner_count desc,
        champion_correct desc,
        display_name asc
    )::bigint as rank
  from scored
  order by pool_id, rank;
$$;

grant execute on function public.get_my_pools_ranking() to authenticated;

-- ------------------------------------------------------------
-- delete_pool: el creador puede eliminar su polla, salvo que ya haya
-- puntos registrados (una polla en curso no se borra). El borrado cascada
-- limpia pool_members y scores; las predicciones son globales y sobreviven.
-- Atómico y SECURITY DEFINER.
-- ------------------------------------------------------------
create or replace function public.delete_pool(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_by uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select created_by into v_created_by
  from public.pools
  where id = p_pool_id
  for update;

  if v_created_by is null then
    raise exception 'pool not found';
  end if;

  if v_created_by <> auth.uid() then
    raise exception 'not authorized';
  end if;

  if exists (select 1 from public.scores where pool_id = p_pool_id) then
    raise exception 'pool has scores';
  end if;

  delete from public.pools where id = p_pool_id;
end;
$$;

grant execute on function public.delete_pool(uuid) to authenticated;

-- ------------------------------------------------------------
-- Nadie se sale de una polla por su cuenta: la única salida es que el
-- creador la elimine. Quitamos la política que permitía auto-borrarse la
-- membresía (el borrado en cascada de delete_pool sigue funcionando: corre
-- como SECURITY DEFINER y no depende de RLS).
-- ------------------------------------------------------------
drop policy if exists "pool_members_delete_self" on public.pool_members;
