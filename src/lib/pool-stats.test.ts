import { describe, expect, it } from "vitest";

import { computePoolStats, MIN_MATCHES_FOR_RECORD, type StatsInput, type StatsMember } from "@/lib/pool-stats";

function member(userId: string, displayName: string, over: Partial<StatsMember> = {}): StatsMember {
  return {
    userId,
    displayName,
    total: 0,
    exactCount: 0,
    diffCount: 0,
    winnerCount: 0,
    championCorrect: false,
    topScorerCorrect: false,
    ...over,
  };
}

// 4 partidos terminados en orden cronológico.
const FINISHED = ["m1", "m2", "m3", "m4"];

describe("computePoolStats", () => {
  it("calcula puntos de partido, aciertos, promedio y % de acierto", () => {
    const input: StatsInput = {
      members: [member("a", "Ana", { total: 10 })],
      finishedMatchIds: FINISHED,
      // Ana predijo los 4; acertó m1 (5), m2 (3), m4 (2); falló m3 (sin fila de score).
      predictions: FINISHED.map((matchId) => ({ userId: "a", matchId })),
      scores: [
        { userId: "a", matchId: "m1", points: 5 },
        { userId: "a", matchId: "m2", points: 3 },
        { userId: "a", matchId: "m4", points: 2 },
      ],
    };
    const { members } = computePoolStats(input);
    const a = members[0]!;
    expect(a.matchPoints).toBe(10);
    expect(a.predictedFinished).toBe(4);
    expect(a.hitCount).toBe(3);
    expect(a.accuracy).toBeCloseTo(3 / 4);
    expect(a.avgPerPredicted).toBeCloseTo(10 / 4);
  });

  it("racha: cuenta partidos seguidos sumando; un 0 la corta", () => {
    const input: StatsInput = {
      members: [member("a", "Ana")],
      finishedMatchIds: FINISHED,
      predictions: FINISHED.map((matchId) => ({ userId: "a", matchId })),
      // m1>0, m2>0, m3=0 (corta), m4>0
      scores: [
        { userId: "a", matchId: "m1", points: 5 },
        { userId: "a", matchId: "m2", points: 3 },
        { userId: "a", matchId: "m4", points: 2 },
      ],
    };
    const a = computePoolStats(input).members[0]!;
    expect(a.longestStreak).toBe(2);
    expect(a.currentStreak).toBe(1);
  });

  it("racha: un fallo simultáneo a un acierto no rompe la racha", () => {
    // c y b son simultáneos (mismo kickoff t1). El array los trae con el acierto
    // (c) listado antes que el fallo (b). Sin agrupar por horario, el 0 de b
    // cortaría la racha justo antes de d, dejándola en 1. Agrupando, el fallo
    // simultáneo no rompe lo que el acierto mantiene: a→1, grupo t1 (c acierto,
    // b fallo)→1, d→2.
    const input: StatsInput = {
      members: [member("a", "Ana")],
      finishedMatchIds: ["a", "c", "b", "d"],
      finishedKickoffs: { a: "t0", c: "t1", b: "t1", d: "t2" },
      predictions: ["a", "c", "b", "d"].map((matchId) => ({ userId: "a", matchId })),
      scores: [
        { userId: "a", matchId: "a", points: 2 },
        { userId: "a", matchId: "c", points: 5 },
        { userId: "a", matchId: "d", points: 3 },
      ],
    };
    const a = computePoolStats(input).members[0]!;
    expect(a.currentStreak).toBe(2);
    expect(a.longestStreak).toBe(2);
  });

  it("excluye puntos no-partido (campeón/goleador) del total de partido", () => {
    const input: StatsInput = {
      members: [member("a", "Ana", { total: 25 })],
      finishedMatchIds: FINISHED,
      predictions: [{ userId: "a", matchId: "m1" }],
      // 'champ' no está entre los partidos terminados → se ignora en matchPoints.
      scores: [
        { userId: "a", matchId: "m1", points: 5 },
        { userId: "a", matchId: "champ", points: 15 },
      ],
    };
    const a = computePoolStats(input).members[0]!;
    expect(a.matchPoints).toBe(5);
    expect(a.total).toBe(25);
  });

  it("récords: aplica el umbral mínimo de partidos predichos", () => {
    // minForRecord = min(5, 4) = 4. Ana predijo 4 (califica), Beto 2 (no).
    const input: StatsInput = {
      members: [member("a", "Ana"), member("b", "Beto")],
      finishedMatchIds: FINISHED,
      predictions: [
        ...FINISHED.map((matchId) => ({ userId: "a", matchId })),
        { userId: "b", matchId: "m1" },
        { userId: "b", matchId: "m2" },
      ],
      scores: [
        { userId: "a", matchId: "m1", points: 5 },
        { userId: "a", matchId: "m2", points: 2 },
        { userId: "b", matchId: "m1", points: 5 }, // avg 2.5, pero solo 2 predichos
      ],
    };
    const stats = computePoolStats(input);
    expect(stats.bestAvg?.members.map((m) => m.userId)).toEqual(["a"]);
    expect(stats.bestAccuracy?.members.map((m) => m.userId)).toEqual(["a"]);
  });

  it("récords: empate → varios líderes", () => {
    const input: StatsInput = {
      members: [member("a", "Ana"), member("b", "Beto")],
      finishedMatchIds: ["m1", "m2"],
      predictions: [
        { userId: "a", matchId: "m1" },
        { userId: "b", matchId: "m1" },
      ],
      scores: [
        { userId: "a", matchId: "m1", points: 5 },
        { userId: "b", matchId: "m1", points: 5 },
      ],
    };
    const stats = computePoolStats(input);
    // minForRecord = min(5,2) = 2... ambos predijeron 1 → no califican para avg/accuracy.
    expect(stats.bestAvg).toBeNull();
    // racha: ambos con 1 → empate en longestStreak.
    expect(stats.longestStreak?.value).toBe(1);
    expect(stats.longestStreak?.members.map((m) => m.userId).sort()).toEqual(["a", "b"]);
  });

  it("sin partidos terminados → récords nulos", () => {
    const input: StatsInput = {
      members: [member("a", "Ana")],
      finishedMatchIds: [],
      predictions: [],
      scores: [],
    };
    const stats = computePoolStats(input);
    expect(stats.totalFinished).toBe(0);
    expect(stats.longestStreak).toBeNull();
    expect(stats.bestAvg).toBeNull();
    expect(stats.bestAccuracy).toBeNull();
    expect(stats.members[0]!.avgPerPredicted).toBe(0);
  });

  it("MIN_MATCHES_FOR_RECORD es el tope del umbral", () => {
    expect(MIN_MATCHES_FOR_RECORD).toBeGreaterThan(0);
  });
});
