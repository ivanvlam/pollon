// Códigos de fase de TheSportsDB (strStatus) → etiqueta en español. La clave
// gratuita no da el minuto (strProgress) pero sí la fase, así que mostramos
// "1ª mitad" / "2ª mitad" / etc. en vez del código crudo.
const PHASE_LABELS: Record<string, string> = {
  "1H": "Primer Tiempo",
  "2H": "Segundo Tiempo",
  HT: "Entretiempo",
  ET: "Alargue",
  BT: "Descanso alargue",
  P: "Penales",
  PEN: "Penales",
  LIVE: "En juego",
};

/**
 * Formatea el indicador de juego en vivo para mostrar. Puede venir el minuto
 * (strProgress, ej. "67" → "67'", "45+2" → "45+2'") o, en la clave gratuita,
 * el código de fase (strStatus, ej. "2H" → "2ª mitad"). Vacío/null → null.
 */
export function formatLiveMinute(m: string | null | undefined): string | null {
  if (!m) return null;
  const t = m.trim();
  if (t === "") return null;
  if (/^\d+(\+\d+)?$/.test(t)) return `${t}'`;
  return PHASE_LABELS[t] ?? t;
}

/**
 * Estima la fase del partido a partir del kickoff. Respaldo para la clave
 * gratuita de TheSportsDB, que a mitad de partido a veces devuelve el status
 * vacío (entonces live_minute queda null y no habría nada que mostrar).
 * Aproximado (no contempla el tiempo añadido exacto), pero suficiente para el
 * indicador. Pasados ~115 min devuelve null (probable alargue/penales o ya
 * terminó: mejor no inventar).
 */
export function estimateLivePhase(kickoffAt: string | null | undefined): string | null {
  if (!kickoffAt) return null;
  const elapsedMin = (Date.now() - new Date(kickoffAt).getTime()) / 60_000;
  if (elapsedMin < 0) return null;
  if (elapsedMin < 47) return "Primer Tiempo";
  if (elapsedMin < 62) return "Entretiempo";
  if (elapsedMin < 115) return "Segundo Tiempo";
  return null;
}

/**
 * Etiqueta de progreso en vivo: usa el dato de la API si existe
 * (minuto o fase), y si no, cae a la estimación por reloj desde el kickoff.
 */
export function liveProgressLabel(
  liveMinute: string | null | undefined,
  kickoffAt: string | null | undefined,
): string | null {
  return formatLiveMinute(liveMinute) ?? estimateLivePhase(kickoffAt);
}
