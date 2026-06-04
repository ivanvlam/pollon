// ============================================================
// Pollon — Mapeo de nombre de equipo → código ISO (para banderas)
// ============================================================
// Las banderas se sirven desde flagcdn.com. Los nombres pueden venir en
// español (datos manuales) o inglés (API-Football), así que el mapa
// incluye alias. Si no hay match, devuelve null y no se muestra bandera.

/** Normaliza: minúsculas, sin acentos, sin espacios extra. */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

const NAME_TO_ISO: Record<string, string> = {
  // Sudamérica
  argentina: "ar",
  brasil: "br",
  brazil: "br",
  uruguay: "uy",
  colombia: "co",
  chile: "cl",
  peru: "pe",
  ecuador: "ec",
  paraguay: "py",
  bolivia: "bo",
  venezuela: "ve",
  // Concacaf
  mexico: "mx",
  "estados unidos": "us",
  usa: "us",
  "united states": "us",
  canada: "ca",
  "costa rica": "cr",
  panama: "pa",
  honduras: "hn",
  jamaica: "jm",
  // Europa
  espana: "es",
  spain: "es",
  francia: "fr",
  france: "fr",
  alemania: "de",
  germany: "de",
  italia: "it",
  italy: "it",
  portugal: "pt",
  inglaterra: "gb-eng",
  england: "gb-eng",
  escocia: "gb-sct",
  scotland: "gb-sct",
  gales: "gb-wls",
  wales: "gb-wls",
  "paises bajos": "nl",
  holanda: "nl",
  netherlands: "nl",
  belgica: "be",
  belgium: "be",
  croacia: "hr",
  croatia: "hr",
  suiza: "ch",
  switzerland: "ch",
  polonia: "pl",
  poland: "pl",
  dinamarca: "dk",
  denmark: "dk",
  suecia: "se",
  sweden: "se",
  serbia: "rs",
  "republica checa": "cz",
  "czech republic": "cz",
  czechia: "cz",
  austria: "at",
  ucrania: "ua",
  ukraine: "ua",
  turquia: "tr",
  turkey: "tr",
  grecia: "gr",
  greece: "gr",
  noruega: "no",
  norway: "no",
  // África
  marruecos: "ma",
  morocco: "ma",
  senegal: "sn",
  "costa de marfil": "ci",
  "ivory coast": "ci",
  camerun: "cm",
  cameroon: "cm",
  ghana: "gh",
  nigeria: "ng",
  egipto: "eg",
  egypt: "eg",
  tunez: "tn",
  tunisia: "tn",
  argelia: "dz",
  algeria: "dz",
  sudafrica: "za",
  "south africa": "za",
  // Asia / Oceanía
  japon: "jp",
  japan: "jp",
  "corea del sur": "kr",
  "south korea": "kr",
  "arabia saudi": "sa",
  "saudi arabia": "sa",
  iran: "ir",
  catar: "qa",
  qatar: "qa",
  australia: "au",
  "emiratos arabes unidos": "ae",
  irak: "iq",
  iraq: "iq",
};

/** Código ISO de la bandera de un equipo, o null si no se reconoce. */
export function teamFlagCode(team: string): string | null {
  return NAME_TO_ISO[normalize(team)] ?? null;
}

/** URL de la bandera (flagcdn) para un código ISO. */
export function flagUrl(code: string, retina = false): string {
  return retina
    ? `https://flagcdn.com/80x60/${code}.png`
    : `https://flagcdn.com/40x30/${code}.png`;
}
