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
