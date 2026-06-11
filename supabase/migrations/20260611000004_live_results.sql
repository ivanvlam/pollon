-- ============================================================
-- Pollon — Resultados semi-en vivo: sdb_round + live_minute
-- ============================================================

-- 1) sdb_round: la sub-ronda de TheSportsDB de cada partido. Permite que el
-- sync pida SOLO la(s) sub-ronda(s) en juego (1 request) en vez de expandir
-- siempre fase de grupos a [1,2,3] (3 requests). Así se puede subir la
-- cadencia del cron a 10 min sin pasar los 100 req/día.
alter table public.matches add column sdb_round integer;

-- Backfill de eliminatorias (mapeo fijo ronda→SDB). Los de grupos quedan null
-- y se setean en el próximo sync (que conoce el número de ronda pedido).
update public.matches set sdb_round = case round
  when 'round_of_32' then 32
  when 'round_of_16' then 16
  when 'quarterfinal' then 125
  when 'semifinal'    then 150
  when 'final'        then 200
end
where round <> 'group_stage';

create index matches_sdb_round_idx on public.matches (sdb_round);

-- 2) live_minute: minuto de juego (campo strProgress de TheSportsDB). Texto
-- para soportar valores como "45+2" o "HT". Solo es significativo mientras
-- status='live'; puede venir null si la API gratuita no lo provee.
alter table public.matches add column live_minute text;
