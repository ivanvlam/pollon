// ============================================================
// Pollon — Colores nacionales por equipo (para el confeti del gol)
// ============================================================
// Clave = nombre del equipo en inglés tal como lo guarda la DB (TheSportsDB).
// 2-3 colores principales de la camiseta/bandera de cada selección. Para los
// equipos que no estén acá, se usa un fallback vistoso multicolor.

const FALLBACK: string[] = ["#22c55e", "#3b82f6", "#eab308", "#ef4444", "#a855f7"];

const TEAM_COLORS: Record<string, string[]> = {
  // CONMEBOL
  Argentina: ["#75AADB", "#FFFFFF", "#F6B40E"],
  Brazil: ["#FFDF00", "#009C3B", "#002776"],
  Uruguay: ["#5CBFEB", "#FFFFFF", "#000000"],
  Colombia: ["#FCD116", "#003893", "#CE1126"],
  Ecuador: ["#FFD100", "#0072CE", "#EF3340"],
  Paraguay: ["#D52B1E", "#0038A8", "#FFFFFF"],
  Peru: ["#D91023", "#FFFFFF"],
  // UEFA
  Spain: ["#C60B1E", "#FFC400"],
  France: ["#0055A4", "#FFFFFF", "#EF4135"],
  England: ["#FFFFFF", "#CF081F", "#001489"],
  Germany: ["#000000", "#DD0000", "#FFCE00"],
  Portugal: ["#006600", "#FF0000"],
  Netherlands: ["#FF6200", "#FFFFFF", "#21468B"],
  Italy: ["#0066CC", "#FFFFFF"],
  Belgium: ["#000000", "#FAE042", "#ED2939"],
  Croatia: ["#FF0000", "#FFFFFF", "#171796"],
  Switzerland: ["#FF0000", "#FFFFFF"],
  Denmark: ["#C60C30", "#FFFFFF"],
  Austria: ["#ED2939", "#FFFFFF"],
  Poland: ["#FFFFFF", "#DC143C"],
  Serbia: ["#C6363C", "#0C4076", "#FFFFFF"],
  Norway: ["#BA0C2F", "#00205B", "#FFFFFF"],
  Scotland: ["#0065BF", "#FFFFFF"],
  "Czech Republic": ["#D7141A", "#11457E", "#FFFFFF"],
  Turkey: ["#E30A17", "#FFFFFF"],
  Ukraine: ["#0057B7", "#FFD700"],
  "Bosnia and Herzegovina": ["#002395", "#FFD200"],
  // CONCACAF
  "United States": ["#3C3B6E", "#B22234", "#FFFFFF"],
  Mexico: ["#006847", "#FFFFFF", "#CE1126"],
  Canada: ["#FF0000", "#FFFFFF"],
  "Costa Rica": ["#002B7F", "#CE1126", "#FFFFFF"],
  Panama: ["#005293", "#D21034", "#FFFFFF"],
  Jamaica: ["#009B3A", "#FED100", "#000000"],
  // CAF
  Morocco: ["#C1272D", "#006233"],
  Senegal: ["#00853F", "#FDEF42", "#E31B23"],
  Nigeria: ["#008751", "#FFFFFF"],
  Egypt: ["#CE1126", "#FFFFFF", "#000000"],
  Ghana: ["#006B3F", "#FCD116", "#CE1126"],
  Cameroon: ["#007A5E", "#CE1126", "#FCD116"],
  Algeria: ["#006233", "#FFFFFF", "#D21034"],
  Tunisia: ["#E70013", "#FFFFFF"],
  "Ivory Coast": ["#F77F00", "#FFFFFF", "#009E60"],
  "South Africa": ["#007A4D", "#FFB915", "#DE3831", "#002395"],
  "Cape Verde": ["#003893", "#FFFFFF", "#CF2027"],
  // AFC
  Japan: ["#BC002D", "#FFFFFF"],
  "South Korea": ["#CD2E3A", "#0047A0", "#FFFFFF"],
  "Saudi Arabia": ["#006C35", "#FFFFFF"],
  Iran: ["#239F40", "#FFFFFF", "#DA0000"],
  Australia: ["#00843D", "#FFCD00"],
  Qatar: ["#8A1538", "#FFFFFF"],
  Uzbekistan: ["#1EB53A", "#0099B5", "#CE1126"],
  Jordan: ["#007A3D", "#CE1126", "#000000"],
  // OFC
  "New Zealand": ["#000000", "#FFFFFF"],
};

/** Colores principales del equipo (para el confeti); fallback si no está mapeado. */
export function getTeamColors(team: string): string[] {
  return TEAM_COLORS[team] ?? FALLBACK;
}
