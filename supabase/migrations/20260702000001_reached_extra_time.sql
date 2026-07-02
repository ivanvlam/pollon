-- ============================================================
-- reached_extra_time: marca si un partido pasó del tiempo reglamentario
-- ============================================================
-- Bug que arregla: el cron congela el marcador a 90' (home_score_90) cuando el
-- proveedor reporta el partido en alargue/penales (past_regulation). Pero esa
-- señal se calculaba SOLO por-poll: cuando el partido finalmente se marca
-- 'finished' con status 'FT' (la clave gratuita de TheSportsDB no siempre
-- reporta 'AET'), past_regulation vuelve a ser false y el poll de cierre pisaba
-- el 90' ya congelado con el marcador de cancha (que incluye el alargue).
-- Caso real: Bélgica 2-2 Senegal a los 90', 3-2 en alargue → home_score_90
-- quedó 3-2 y el scoring de KO (que usa los 90') calculó mal.
--
-- Al persistir reached_extra_time = true en cuanto se ve UN poll pasado del
-- reglamentario, el cron ya no vuelve a pisar el 90' en el cierre.
alter table matches
  add column if not exists reached_extra_time boolean not null default false;
