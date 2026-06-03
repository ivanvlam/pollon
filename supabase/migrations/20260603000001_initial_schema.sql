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
