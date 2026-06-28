// ============================================================
// Pollon — Fixture oficial de la fase eliminatoria (Mundial 2026)
// ============================================================
// Estructura y horarios oficiales de la FIFA (Annex C + match schedule),
// validados contra TheSportsDB para los partidos ya publicados. Fuente única de
// verdad del bracket: define para cada partido (73–104) su número, ronda,
// kickoff (UTC) y de dónde salen sus dos equipos.
//
// Los EQUIPOS no se hardcodean: se derivan de la tabla de grupos real (winner /
// runnerUp / 3° del grupo) o del ganador del feeder. Acá solo vive la
// estructura/calendario, que es fijo y público.
//
// La asignación de mejores terceros ({type:"third", group}) ya está resuelta
// según la combinación de grupos clasificados (B,D,E,F,I,J,K,L) por la tabla de
// 495 combinaciones de la FIFA.

import type { Round } from "@/types";

export type KnockoutSlot =
  | { type: "winner"; group: string }    // 1° del grupo
  | { type: "runnerUp"; group: string }  // 2° del grupo
  | { type: "third"; group: string }     // 3° de un grupo específico (ya asignado)
  | { type: "feeder"; matchNum: number } // ganador de un partido previo
  | { type: "loser"; matchNum: number }; // perdedor de un partido previo (3er puesto)

export interface KnockoutMatchDef {
  matchNum: number;
  round: Round;
  kickoff: string; // ISO UTC
  home: KnockoutSlot;
  away: KnockoutSlot;
}

const w = (group: string): KnockoutSlot => ({ type: "winner", group });
const r = (group: string): KnockoutSlot => ({ type: "runnerUp", group });
const t = (group: string): KnockoutSlot => ({ type: "third", group });
const f = (matchNum: number): KnockoutSlot => ({ type: "feeder", matchNum });
const l = (matchNum: number): KnockoutSlot => ({ type: "loser", matchNum });

/** Todos los partidos de eliminatoria por número de partido (sin el 3er puesto, #103). */
export const KNOCKOUT_MATCHES: Record<number, KnockoutMatchDef> = {
  // ── Dieciseisavos (round_of_32) ──────────────────────────────────────────
  73: { matchNum: 73, round: "round_of_32", kickoff: "2026-06-28T19:00:00Z", home: r("A"), away: r("B") },
  74: { matchNum: 74, round: "round_of_32", kickoff: "2026-06-29T20:30:00Z", home: w("E"), away: t("D") },
  75: { matchNum: 75, round: "round_of_32", kickoff: "2026-06-30T01:00:00Z", home: w("F"), away: r("C") },
  76: { matchNum: 76, round: "round_of_32", kickoff: "2026-06-29T17:00:00Z", home: w("C"), away: r("F") },
  77: { matchNum: 77, round: "round_of_32", kickoff: "2026-06-30T21:00:00Z", home: w("I"), away: t("F") },
  78: { matchNum: 78, round: "round_of_32", kickoff: "2026-06-30T17:00:00Z", home: r("E"), away: r("I") },
  79: { matchNum: 79, round: "round_of_32", kickoff: "2026-07-01T01:00:00Z", home: w("A"), away: t("E") },
  80: { matchNum: 80, round: "round_of_32", kickoff: "2026-07-01T16:00:00Z", home: w("L"), away: t("K") },
  81: { matchNum: 81, round: "round_of_32", kickoff: "2026-07-02T00:00:00Z", home: w("D"), away: t("B") },
  82: { matchNum: 82, round: "round_of_32", kickoff: "2026-07-01T20:00:00Z", home: w("G"), away: t("I") },
  83: { matchNum: 83, round: "round_of_32", kickoff: "2026-07-02T23:00:00Z", home: r("K"), away: r("L") },
  84: { matchNum: 84, round: "round_of_32", kickoff: "2026-07-02T19:00:00Z", home: w("H"), away: r("J") },
  85: { matchNum: 85, round: "round_of_32", kickoff: "2026-07-03T03:00:00Z", home: w("B"), away: t("J") },
  86: { matchNum: 86, round: "round_of_32", kickoff: "2026-07-03T22:00:00Z", home: w("J"), away: r("H") },
  87: { matchNum: 87, round: "round_of_32", kickoff: "2026-07-04T01:30:00Z", home: w("K"), away: t("L") },
  88: { matchNum: 88, round: "round_of_32", kickoff: "2026-07-03T18:00:00Z", home: r("D"), away: r("G") },
  // ── Octavos (round_of_16) ────────────────────────────────────────────────
  89: { matchNum: 89, round: "round_of_16", kickoff: "2026-07-04T21:00:00Z", home: f(74), away: f(77) },
  90: { matchNum: 90, round: "round_of_16", kickoff: "2026-07-04T17:00:00Z", home: f(73), away: f(75) },
  91: { matchNum: 91, round: "round_of_16", kickoff: "2026-07-05T20:00:00Z", home: f(76), away: f(78) },
  92: { matchNum: 92, round: "round_of_16", kickoff: "2026-07-06T00:00:00Z", home: f(79), away: f(80) },
  93: { matchNum: 93, round: "round_of_16", kickoff: "2026-07-06T19:00:00Z", home: f(83), away: f(84) },
  94: { matchNum: 94, round: "round_of_16", kickoff: "2026-07-07T00:00:00Z", home: f(81), away: f(82) },
  95: { matchNum: 95, round: "round_of_16", kickoff: "2026-07-07T16:00:00Z", home: f(86), away: f(88) },
  96: { matchNum: 96, round: "round_of_16", kickoff: "2026-07-07T20:00:00Z", home: f(85), away: f(87) },
  // ── Cuartos (quarterfinal) ───────────────────────────────────────────────
  97: { matchNum: 97, round: "quarterfinal", kickoff: "2026-07-09T20:00:00Z", home: f(89), away: f(90) },
  98: { matchNum: 98, round: "quarterfinal", kickoff: "2026-07-10T19:00:00Z", home: f(93), away: f(94) },
  99: { matchNum: 99, round: "quarterfinal", kickoff: "2026-07-11T21:00:00Z", home: f(91), away: f(92) },
  100: { matchNum: 100, round: "quarterfinal", kickoff: "2026-07-12T01:00:00Z", home: f(95), away: f(96) },
  // ── Semifinales (semifinal) ──────────────────────────────────────────────
  101: { matchNum: 101, round: "semifinal", kickoff: "2026-07-14T19:00:00Z", home: f(97), away: f(98) },
  102: { matchNum: 102, round: "semifinal", kickoff: "2026-07-15T19:00:00Z", home: f(99), away: f(100) },
  // ── Tercer puesto (third_place) ──────────────────────────────────────────
  103: { matchNum: 103, round: "third_place", kickoff: "2026-07-18T21:00:00Z", home: l(101), away: l(102) },
  // ── Final ────────────────────────────────────────────────────────────────
  104: { matchNum: 104, round: "final", kickoff: "2026-07-19T19:00:00Z", home: f(101), away: f(102) },
};

/**
 * Orden de visualización del bracket (de arriba hacia abajo), cronológico dentro
 * de lo que permite el árbol: la llave i de una ronda se alimenta de las llaves
 * 2i y 2i+1 de la ronda anterior (geometría estándar del bracket).
 */
export const BRACKET_ORDER: Record<Round, number[]> = {
  group_stage: [],
  round_of_32: [73, 75, 74, 77, 82, 81, 84, 83, 76, 78, 79, 80, 85, 87, 88, 86],
  round_of_16: [90, 89, 94, 93, 91, 92, 96, 95],
  quarterfinal: [97, 98, 99, 100],
  semifinal: [101, 102],
  third_place: [103],
  final: [104],
};

/** Los 16 dieciseisavos en orden cronológico (para cargar a la DB). */
export const R32_MATCH_NUMS = BRACKET_ORDER.round_of_32;
