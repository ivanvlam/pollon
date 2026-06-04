import { describe, expect, it } from "vitest";

import { computeGroupStandings, type GroupMatch } from "@/lib/standings";

function m(
  home: string,
  away: string,
  hs: number | null,
  as: number | null,
  status = "finished",
): GroupMatch {
  return { home_team: home, away_team: away, home_score: hs, away_score: as, status };
}

describe("computeGroupStandings", () => {
  it("incluye a todos los equipos aunque no hayan jugado", () => {
    const rows = computeGroupStandings([m("A", "B", null, null, "scheduled")]);
    expect(rows.map((r) => r.team).sort()).toEqual(["A", "B"]);
    expect(rows.every((r) => r.played === 0 && r.points === 0)).toBe(true);
  });

  it("victoria = 3 pts, derrota = 0", () => {
    const rows = computeGroupStandings([m("A", "B", 2, 0)]);
    const a = rows.find((r) => r.team === "A")!;
    const b = rows.find((r) => r.team === "B")!;
    expect(a.points).toBe(3);
    expect(a.won).toBe(1);
    expect(a.gd).toBe(2);
    expect(b.points).toBe(0);
    expect(b.lost).toBe(1);
  });

  it("empate = 1 pt cada uno", () => {
    const rows = computeGroupStandings([m("A", "B", 1, 1)]);
    expect(rows.every((r) => r.points === 1 && r.drawn === 1)).toBe(true);
  });

  it("ordena por puntos, luego diferencia de gol, luego goles a favor", () => {
    // A: 3pts (gd+3); B: 3pts (gd+1); C: 0; D: 0
    const rows = computeGroupStandings([
      m("A", "C", 3, 0),
      m("B", "D", 1, 0),
    ]);
    expect(rows.map((r) => r.team)).toEqual(["A", "B", "C", "D"]);
  });

  it("ignora partidos no finalizados para los puntos", () => {
    const rows = computeGroupStandings([
      m("A", "B", 2, 0),
      m("A", "C", 5, 0, "scheduled"),
    ]);
    const a = rows.find((r) => r.team === "A")!;
    expect(a.played).toBe(1);
    expect(a.points).toBe(3);
  });
});
