import { describe, expect, it } from "vitest";

import { computeRaceFrames, type RaceHistoryPoint, type RaceMember } from "@/lib/race";

const MEMBERS: RaceMember[] = [
  { id: "a", name: "Ana" },
  { id: "b", name: "Beto" },
];

/** Helper: arma un punto de historial con acumulados y ganados explícitos. */
function point(
  cumulative: Record<string, number>,
  earned: Record<string, number>,
): RaceHistoryPoint {
  return {
    homeTeam: "Chile",
    awayTeam: "Brazil",
    homeScore: 1,
    awayScore: 0,
    kickoffAt: "2026-06-11T20:00:00Z",
    cumulativePoints: cumulative,
    pointsEarned: earned,
  };
}

describe("computeRaceFrames", () => {
  it("el líder cae justo en partidosJugados/total al final", () => {
    const history = [
      point({ a: 5, b: 0 }, { a: 5, b: 0 }),
      point({ a: 8, b: 2 }, { a: 3, b: 2 }),
    ];
    const { frames, leaderFinalX } = computeRaceFrames({
      history,
      members: MEMBERS,
      totalMatches: 104,
    });
    expect(leaderFinalX).toBeCloseTo(2 / 104);
    const last = frames[frames.length - 1]!;
    const leader = last.cars.find((c) => c.userId === "a")!;
    expect(leader.x).toBeCloseTo(2 / 104); // líder en la fracción jugada
    expect(leader.rank).toBe(1);
  });

  it("toca la meta (x=1) solo cuando se juegan los 104", () => {
    const history = Array.from({ length: 104 }, (_, i) =>
      point({ a: i + 1, b: 0 }, { a: 1, b: 0 }),
    );
    const { frames } = computeRaceFrames({ history, members: MEMBERS, totalMatches: 104 });
    const leader = frames[103]!.cars.find((c) => c.userId === "a")!;
    expect(leader.x).toBeCloseTo(1);
  });

  it("avanza a todos con deriva constante aunque no sumen", () => {
    const history = [
      point({ a: 0, b: 0 }, { a: 0, b: 0 }),
      point({ a: 0, b: 0 }, { a: 0, b: 0 }),
      point({ a: 0, b: 0 }, { a: 0, b: 0 }),
    ];
    const { frames } = computeRaceFrames({ history, members: MEMBERS, totalMatches: 104, drift: 0.6 });
    const xs = frames.map((f) => f.cars.find((c) => c.userId === "a")!.x);
    expect(xs[0]!).toBeGreaterThan(0);
    expect(xs[1]!).toBeGreaterThan(xs[0]!);
    expect(xs[2]!).toBeGreaterThan(xs[1]!);
  });

  it("el salto entre frames es proporcional a los puntos ganados", () => {
    // Mismo punto de partida; en el 2º partido Ana gana 5 y Beto 0.
    const history = [
      point({ a: 0, b: 0 }, { a: 0, b: 0 }),
      point({ a: 5, b: 0 }, { a: 5, b: 0 }),
    ];
    const { frames } = computeRaceFrames({ history, members: MEMBERS, totalMatches: 104, drift: 0.6 });
    const dxA =
      frames[1]!.cars.find((c) => c.userId === "a")!.x -
      frames[0]!.cars.find((c) => c.userId === "a")!.x;
    const dxB =
      frames[1]!.cars.find((c) => c.userId === "b")!.x -
      frames[0]!.cars.find((c) => c.userId === "b")!.x;
    // Ana avanza drift+5; Beto solo drift. Ratio ≈ (0.6+5)/0.6.
    expect(dxA / dxB).toBeCloseTo((0.6 + 5) / 0.6, 1);
  });

  it("expone los puntos ganados del partido para el badge +N", () => {
    const history = [point({ a: 3, b: 0 }, { a: 3, b: 0 })];
    const { frames } = computeRaceFrames({ history, members: MEMBERS });
    expect(frames[0]!.cars.find((c) => c.userId === "a")!.gained).toBe(3);
    expect(frames[0]!.cars.find((c) => c.userId === "b")!.gained).toBe(0);
  });

  it("nunca retrocede (x monótona creciente por jugador)", () => {
    const history = [
      point({ a: 2, b: 5 }, { a: 2, b: 5 }),
      point({ a: 7, b: 5 }, { a: 5, b: 0 }),
      point({ a: 7, b: 8 }, { a: 0, b: 3 }),
    ];
    const { frames } = computeRaceFrames({ history, members: MEMBERS, totalMatches: 104 });
    for (const id of ["a", "b"]) {
      const xs = frames.map((f) => f.cars.find((c) => c.userId === id)!.x);
      for (let i = 1; i < xs.length; i++) expect(xs[i]!).toBeGreaterThanOrEqual(xs[i - 1]!);
    }
  });

  it("sin puntos en ningún partido no produce NaN", () => {
    const history = [point({ a: 0, b: 0 }, { a: 0, b: 0 })];
    const { frames } = computeRaceFrames({ history, members: MEMBERS });
    for (const car of frames[0]!.cars) {
      expect(Number.isFinite(car.x)).toBe(true);
    }
  });
});
