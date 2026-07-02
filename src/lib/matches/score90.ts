// ============================================================
// Pollon — Resolución del marcador a 90' entre polls del cron (función pura)
// ============================================================
// El scoring de eliminatorias usa el marcador a los 90' (home_score_90), NO el
// de cancha (que incluye alargue). El cron lo captura en vivo durante el
// reglamentario y debe CONGELARLO en cuanto el partido pasa al alargue/penales.
//
// El problema que resuelve: `past_regulation` que reporta el proveedor es una
// señal por-poll. La clave gratuita de TheSportsDB no siempre marca el cierre
// como 'AET' (a veces 'FT'), así que en el poll final past_regulation vuelve a
// false y, sin memoria, el marcador de cancha (con alargue) pisaba el 90' ya
// congelado. Persistir `reached_extra_time` da esa memoria: una vez visto un
// poll pasado del reglamentario, el 90' queda intocable.

export interface Score90State {
  home_score_90: number | null;
  away_score_90: number | null;
  reached_extra_time: boolean;
}

export interface Score90Fixture {
  home_score_90: number | null; // = marcador actual salvo si past_regulation → null
  away_score_90: number | null;
  past_regulation: boolean;
}

/**
 * Combina el estado previo del partido en la DB con el fixture recién traído
 * para decidir el marcador a 90' a persistir.
 *
 * - Reglamentario en curso: el 90' sigue al marcador actual (goles cuentan).
 * - Pasado el reglamentario (ahora o en algún poll previo): el 90' queda
 *   congelado en el último valor capturado en vivo; nunca lo pisa el marcador
 *   de cancha. Si nunca se capturó en vivo (cron caído en el 2T), cae al del
 *   fixture como best-effort.
 */
export function resolveScore90(
  prev: Score90State | undefined,
  fixture: Score90Fixture,
): Score90State {
  const reached = (prev?.reached_extra_time ?? false) || fixture.past_regulation;

  if (reached) {
    return {
      home_score_90: prev?.home_score_90 ?? fixture.home_score_90 ?? null,
      away_score_90: prev?.away_score_90 ?? fixture.away_score_90 ?? null,
      reached_extra_time: true,
    };
  }

  return {
    home_score_90: fixture.home_score_90 ?? prev?.home_score_90 ?? null,
    away_score_90: fixture.away_score_90 ?? prev?.away_score_90 ?? null,
    reached_extra_time: false,
  };
}
