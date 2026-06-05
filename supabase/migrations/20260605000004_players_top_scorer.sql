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
