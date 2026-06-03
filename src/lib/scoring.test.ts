import { describe, expect, it } from "vitest";

import { calculateMatchScore } from "@/lib/scoring";
import type { ScoredMatch, ScoredPrediction } from "@/lib/scoring";

function group(home: number, away: number, winner: "home" | "away" | null = null): ScoredMatch {
  return { round: "group_stage", home_score: home, away_score: away, winner };
}

function knockout(
  home: number,
  away: number,
  winner: "home" | "away" | null,
): ScoredMatch {
  return { round: "round_of_16", home_score: home, away_score: away, winner };
}

function pred(
  h: number | null,
  a: number | null,
  w: "home" | "away" | null = null,
): ScoredPrediction {
  return { predicted_home: h, predicted_away: a, predicted_winner: w };
}

describe("calculateMatchScore — fase de grupos", () => {
  it("da 3 pts por marcador exacto", () => {
    expect(calculateMatchScore(group(2, 1), pred(2, 1))).toEqual({
      points: 3,
      reason: "exact_score",
    });
  });

  it("da 1 pt por acertar el ganador sin marcador exacto", () => {
    expect(calculateMatchScore(group(3, 0), pred(2, 1))).toEqual({
      points: 1,
      reason: "correct_winner",
    });
  });

  it("da 1 pt por acertar el empate sin marcador exacto", () => {
    expect(calculateMatchScore(group(2, 2), pred(1, 1))).toEqual({
      points: 1,
      reason: "correct_draw",
    });
  });

  it("da 0 (null) si falla el resultado", () => {
    expect(calculateMatchScore(group(0, 1), pred(2, 1))).toBeNull();
  });

  it("los puntos son excluyentes: exacto no suma el de ganador", () => {
    const score = calculateMatchScore(group(2, 1), pred(2, 1));
    expect(score?.points).toBe(3);
  });
});

describe("calculateMatchScore — eliminatorias", () => {
  it("da 4 pts por exacto + clasificado", () => {
    expect(calculateMatchScore(knockout(2, 1, "home"), pred(2, 1, "home"))).toEqual(
      { points: 4, reason: "exact_qualifier_score" },
    );
  });

  it("da 2 pts por solo acertar quién clasifica", () => {
    expect(calculateMatchScore(knockout(2, 1, "home"), pred(1, 0, "home"))).toEqual(
      { points: 2, reason: "correct_qualifier" },
    );
  });

  it("da 2 pts por marcador exacto aunque falle el clasificado (penales)", () => {
    // Predice 1-1 y que pase home; termina 1-1 pero clasifica away por penales.
    expect(calculateMatchScore(knockout(1, 1, "away"), pred(1, 1, "home"))).toEqual(
      { points: 2, reason: "exact_score" },
    );
  });

  it("da null si falla ambos", () => {
    expect(
      calculateMatchScore(knockout(2, 1, "away"), pred(0, 0, "home")),
    ).toBeNull();
  });
});

describe("calculateMatchScore — casos incompletos", () => {
  it("null si el partido no tiene resultado", () => {
    expect(
      calculateMatchScore(
        { round: "group_stage", home_score: null, away_score: null, winner: null },
        pred(2, 1),
      ),
    ).toBeNull();
  });

  it("null si la predicción está incompleta", () => {
    expect(calculateMatchScore(group(2, 1), pred(null, 1))).toBeNull();
  });

  it("null si solo falta el marcador visitante", () => {
    expect(calculateMatchScore(group(2, 1), pred(2, null))).toBeNull();
  });
});

describe("calculateMatchScore — bordes adicionales", () => {
  it("grupo 0-0 exacto → 3 exact_score", () => {
    expect(calculateMatchScore(group(0, 0), pred(0, 0))).toEqual({
      points: 3,
      reason: "exact_score",
    });
  });

  it("grupo marcador alto exacto 5-4 → 3", () => {
    expect(calculateMatchScore(group(5, 4), pred(5, 4))).toEqual({
      points: 3,
      reason: "exact_score",
    });
  });

  it("grupo: predije empate pero ganó local → null", () => {
    expect(calculateMatchScore(group(2, 0), pred(1, 1))).toBeNull();
  });

  it("grupo: predije local pero fue empate → null", () => {
    expect(calculateMatchScore(group(1, 1), pred(2, 1))).toBeNull();
  });

  it("grupo: empate acertado con marcadores distintos (0-0 vs 3-3) → 1 correct_draw", () => {
    expect(calculateMatchScore(group(3, 3), pred(0, 0))).toEqual({
      points: 1,
      reason: "correct_draw",
    });
  });

  it("elim 0-0 con clasificado correcto (penales) → 4 exact_qualifier_score", () => {
    expect(calculateMatchScore(knockout(0, 0, "home"), pred(0, 0, "home"))).toEqual(
      { points: 4, reason: "exact_qualifier_score" },
    );
  });

  it("elim: exacto pero sin predecir clasificado (winner null) → 2 exact_score", () => {
    expect(calculateMatchScore(knockout(2, 1, "home"), pred(2, 1, null))).toEqual(
      { points: 2, reason: "exact_score" },
    );
  });

  it("elim: match sin winner definido y predicción no exacta → null", () => {
    expect(calculateMatchScore(knockout(2, 1, null), pred(1, 0, "home"))).toBeNull();
  });
});
