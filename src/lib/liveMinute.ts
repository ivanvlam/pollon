// Códigos de fase de TheSportsDB (strStatus) → etiqueta en español. La clave
// gratuita no da el minuto (strProgress) pero sí la fase, así que mostramos
// "1ª mitad" / "2ª mitad" / etc. en vez del código crudo.
const PHASE_LABELS: Record<string, string> = {
  "1H": "1ª mitad",
  "2H": "2ª mitad",
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
