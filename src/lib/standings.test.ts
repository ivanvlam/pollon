import { describe, expect, it } from "vitest";

import {
  computeGroupStandings,
  projectLivePositions,
  type GroupMatch,
} from "@/lib/standings";

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
    // A: 3pts (gd+3); B: 3pts (gd+1); luego empatan a 0: D (gd-1) sobre C (gd-3)
    const rows = computeGroupStandings([
      m("A", "C", 3, 0),
      m("B", "D", 1, 0),
    ]);
    expect(rows.map((r) => r.team)).toEqual(["A", "B", "D", "C"]);
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

describe("projectLivePositions", () => {
  it("marca subir/bajar/mantener según el marcador en vivo", () => {
    // Fecha 1 jugada: A 1°, B 2°, C 3°, D 4°.
    // En vivo: D le gana a A → D sube, A baja.
    const proj = projectLivePositions([
      m("A", "X", 3, 0),
      m("B", "X", 2, 0),
      m("C", "X", 1, 0),
      m("D", "X", 0, 0),
      m("D", "A", 2, 0, "live"),
    ]);
    expect(proj.get("D")!.dir).toBe("up");
    expect(proj.get("A")!.dir).toBe("down");
    expect(proj.get("D")!.pos).toBeLessThan(proj.get("A")!.pos);
  });

  it("se mantiene cuando el marcador en vivo no cambia el orden", () => {
    // A va 1° tras la fecha 1 y en vivo gana de nuevo → se mantiene.
    const proj = projectLivePositions([
      m("A", "B", 3, 0),
      m("A", "C", 1, 0, "live"),
    ]);
    expect(proj.get("A")!.dir).toBe("same");
  });

  it("aplica el desempate puntos → diferencia → goles a favor en la proyección", () => {
    // Tras proyectar el live, A y B quedan a 3 pts: A gd+1, B gd+3 → B 1°, A 2°.
    const proj = projectLivePositions([
      m("A", "X", 1, 0, "live"), // A: 3pts gd+1
      m("B", "X", 3, 0, "live"), // B: 3pts gd+3
    ]);
    expect(proj.get("B")!.pos).toBe(1);
    expect(proj.get("A")!.pos).toBe(2);
  });
});
