/**
 * Formatea el minuto de juego en vivo (campo strProgress de TheSportsDB) para
 * mostrar. Numérico → con apóstrofo ("67" → "67'", "45+2" → "45+2'"); otros
 * valores se muestran tal cual ("HT", "ET"). Vacío/null → null (no mostrar).
 */
export function formatLiveMinute(m: string | null | undefined): string | null {
  if (!m) return null;
  const t = m.trim();
  if (t === "") return null;
  return /^\d+(\+\d+)?$/.test(t) ? `${t}'` : t;
}
