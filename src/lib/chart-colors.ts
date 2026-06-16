// ============================================================
// Pollon — Paleta de colores por jugador (gráficos del historial)
// ============================================================
// Fuente única de verdad del color de cada participante. La usan tanto el
// gráfico de posiciones (RankingHistoryChart) como la carrera (RankingRaceChart),
// para que el auto de un jugador tenga EXACTAMENTE el mismo color que su línea.
// El color se asigna por el orden de `members` (índice → color, cíclico).

export const CHART_COLORS = [
  "#34d399",
  "#60a5fa",
  "#fbbf24",
  "#f87171",
  "#a78bfa",
  "#f472b6",
  "#2dd4bf",
  "#fb923c",
  "#a3e635",
  "#38bdf8",
  "#c084fc",
  "#4ade80",
] as const;

/** Mapa userId → color, asignado por el orden de los ids recibidos. */
export function buildColorMap(ids: string[]): Map<string, string> {
  const map = new Map<string, string>();
  ids.forEach((id, i) => map.set(id, CHART_COLORS[i % CHART_COLORS.length]!));
  return map;
}
