import { describe, expect, it } from "vitest";

import { calculateMatchScore, regulationScore } from "@/lib/scoring";
import type { ScoredMatch, ScoredPrediction } from "@/lib/scoring";

function group(home: number, away: number): ScoredMatch {
  return { round: "group_stage", home_score: home, away_score: away, winner: null };
}

function knockout(home: number, away: number, winner: "home" | "away" | null): ScoredMatch {
  return { round: "round_of_16", home_score: home, away_score: away, winner };
}

function pred(h: number | null, a: number | null, w: "home" | "away" | null = null): ScoredPrediction {
  return { predicted_home: h, predicted_away: a, predicted_winner: w };
}

describe("regulationScore (marcador a 90')", () => {
  it("usa *_90 cuando existe (KO con goles en el alargue)", () => {
    // Terminó 2-1 en cancha, pero a 90' iba 1-1.
    expect(
      regulationScore({ home_score: 2, away_score: 1, home_score_90: 1, away_score_90: 1 }),
    ).toEqual({ home: 1, away: 1 });
  });

  it("cae al marcador de cancha si no hay *_90 (grupos o no capturado)", () => {
    expect(
      regulationScore({ home_score: 3, away_score: 0, home_score_90: null, away_score_90: null }),
    ).toEqual({ home: 3, away: 0 });
    expect(regulationScore({ home_score: 2, away_score: 2 })).toEqual({ home: 2, away: 2 });
  });

  it("empate a 90' + clasificado puntúa 3 aunque en cancha haya terminado decidido", () => {
    // A 90' fue empate 1-1 (a penales); el scoring KO usa ese marcador.
    const reg = regulationScore({ home_score: 1, away_score: 1, home_score_90: 1, away_score_90: 1 });
    expect(
      calculateMatchScore(
        { round: "round_of_16", home_score: reg.home, away_score: reg.away, winner: "home" },
        pred(2, 2, "home"),
      ),
    ).toEqual({ points: 3, reason: "correct_diff_qualifier" });
  });
});

describe("fase de grupos", () => {
  it("5 pts por marcador exacto", () => {
    expect(calculateMatchScore(group(2, 1), pred(2, 1))).toEqual({ points: 5, reason: "exact_score" });
  });

  it("3 pts por mismo tipo + misma diferencia (home win by 2)", () => {
    expect(calculateMatchScore(group(3, 1), pred(2, 0))).toEqual({ points: 3, reason: "correct_diff" });
  });

  it("3 pts por mismo tipo + misma diferencia (away win by 1)", () => {
    expect(calculateMatchScore(group(0, 1), pred(1, 2))).toEqual({ points: 3, reason: "correct_diff" });
  });

  it("3 pts por empate con marcador distinto (diff siempre 0)", () => {
    expect(calculateMatchScore(group(2, 2), pred(1, 1))).toEqual({ points: 3, reason: "correct_diff" });
  });

  it("3 pts por empate 3-3 predicho 0-0", () => {
    expect(calculateMatchScore(group(3, 3), pred(0, 0))).toEqual({ points: 3, reason: "correct_diff" });
  });

  it("2 pts por acertar ganador sin exacto ni diferencia", () => {
    expect(calculateMatchScore(group(3, 0), pred(2, 1))).toEqual({ points: 2, reason: "correct_winner" });
  });

  it("null si falla el resultado", () => {
    expect(calculateMatchScore(group(0, 1), pred(2, 1))).toBeNull();
  });

  it("null si predijo ganador equivocado", () => {
    expect(calculateMatchScore(group(1, 1), pred(2, 1))).toBeNull();
  });

  it("exacto 0-0 → 5 pts", () => {
    expect(calculateMatchScore(group(0, 0), pred(0, 0))).toEqual({ points: 5, reason: "exact_score" });
  });

  it("exacto 5-4 → 5 pts", () => {
    expect(calculateMatchScore(group(5, 4), pred(5, 4))).toEqual({ points: 5, reason: "exact_score" });
  });
});

describe("eliminatorias", () => {
  it("5 pts por exacto + clasificado", () => {
    expect(calculateMatchScore(knockout(2, 1, "home"), pred(2, 1, "home"))).toEqual({
      points: 5,
      reason: "exact_qualifier_score",
    });
  });

  it("3 pts por misma diferencia + clasificado", () => {
    expect(calculateMatchScore(knockout(3, 1, "home"), pred(2, 0, "home"))).toEqual({
      points: 3,
      reason: "correct_diff_qualifier",
    });
  });

  it("2 pts por solo clasificado correcto (diferencia distinta)", () => {
    expect(calculateMatchScore(knockout(3, 0, "home"), pred(2, 1, "home"))).toEqual({
      points: 2,
      reason: "correct_qualifier",
    });
  });

  it("empate EXACTO a 90' sin clasificado → 3 pts", () => {
    expect(calculateMatchScore(knockout(1, 1, "away"), pred(1, 1, "home"))).toEqual({
      points: 3,
      reason: "correct_diff_qualifier",
    });
  });

  it("empate a 90' acertado (no exacto) sin clasificado → 2 pts", () => {
    expect(calculateMatchScore(knockout(0, 0, "away"), pred(1, 1, "home"))).toEqual({
      points: 2,
      reason: "correct_draw",
    });
  });

  it("empate a 90' (no exacto) con clasificado → 3 pts (tipo + misma diff 0)", () => {
    expect(calculateMatchScore(knockout(0, 0, "home"), pred(1, 1, "home"))).toEqual({
      points: 3,
      reason: "correct_diff_qualifier",
    });
  });

  it("null si falla clasificado y marcador", () => {
    expect(calculateMatchScore(knockout(2, 1, "away"), pred(0, 0, "home"))).toBeNull();
  });

  it("null si no predijo clasificado (winner null)", () => {
    expect(calculateMatchScore(knockout(2, 1, "home"), pred(2, 1, null))).toBeNull();
  });

  it("0-0 con penales — exacto + clasificado correcto → 5 pts", () => {
    expect(calculateMatchScore(knockout(0, 0, "home"), pred(0, 0, "home"))).toEqual({
      points: 5,
      reason: "exact_qualifier_score",
    });
  });
});

describe("predicciones incompletas", () => {
  it("null si el partido no tiene resultado", () => {
    expect(
      calculateMatchScore(
        { round: "group_stage", home_score: null, away_score: null, winner: null },
        pred(2, 1),
      ),
    ).toBeNull();
  });

  it("null si falta gol local en predicción", () => {
    expect(calculateMatchScore(group(2, 1), pred(null, 1))).toBeNull();
  });

  it("null si falta gol visitante en predicción", () => {
    expect(calculateMatchScore(group(2, 1), pred(2, null))).toBeNull();
  });
});
