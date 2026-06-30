-- ============================================================
-- Marcador a 90' (reglamentario) + tanda de penales en eliminatorias
-- ============================================================
-- home_score/away_score siguen siendo el resultado EN CANCHA (incluye alargue,
-- lo que da la API en intHomeScore/intAwayScore) → se usa para mostrar.
--
-- home_score_90/away_score_90 son el marcador a los 90' (tiempo reglamentario),
-- capturados en vivo por el cron durante 1H/HT/2H. El scoring de eliminatorias
-- usa ESTE marcador (regla "a 90 minutos"). En fase de grupos quedan null y el
-- scoring cae al marcador normal.
--
-- home_pen/away_pen: resultado de la tanda de penales (intHomeScoreExtra/
-- intAwayScoreExtra de TheSportsDB, status "AP"). Sirve para mostrar (marcador
-- entre paréntesis) y para derivar el clasificado automáticamente cuando hay
-- empate en cancha.
alter table matches
  add column if not exists home_score_90 integer,
  add column if not exists away_score_90 integer,
  add column if not exists home_pen      integer,
  add column if not exists away_pen      integer;
