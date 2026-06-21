import { describe, expect, it } from "vitest";

import {
  computeGroupClinch,
  computeGroupPositionLock,
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

describe("computeGroupClinch", () => {
  it("marca 'qualified' a quien ya no puede salir del top-2", () => {
    // A ganó sus 3 partidos (9 pts). B, C, D aún juegan entre sí pero ninguno
    // puede alcanzar 9 → A es 1° o 2° pase lo que pase.
    const clinch = computeGroupClinch([
      m("A", "B", 1, 0),
      m("A", "C", 1, 0),
      m("A", "D", 1, 0),
      m("B", "C", null, null, "scheduled"),
      m("B", "D", null, null, "scheduled"),
      m("C", "D", null, null, "scheduled"),
    ]);
    expect(clinch.get("A")).toBe("qualified");
    expect(clinch.get("B")).toBe("open");
  });

  it("marca 'eliminated' a quien ya no puede salir del último puesto", () => {
    // D perdió sus 3 partidos (0 pts, ya jugó todo). A, B y C tienen ≥3 → D es
    // último seguro.
    const clinch = computeGroupClinch([
      m("A", "D", 1, 0),
      m("B", "D", 1, 0),
      m("C", "D", 1, 0),
      m("A", "B", null, null, "scheduled"),
      m("A", "C", null, null, "scheduled"),
      m("B", "C", null, null, "scheduled"),
    ]);
    expect(clinch.get("D")).toBe("eliminated");
    expect(clinch.get("A")).toBe("open");
  });

  it("deja todo en 'open' cuando aún no se juega nada", () => {
    const clinch = computeGroupClinch([
      m("A", "B", null, null, "scheduled"),
      m("A", "C", null, null, "scheduled"),
      m("A", "D", null, null, "scheduled"),
      m("B", "C", null, null, "scheduled"),
      m("B", "D", null, null, "scheduled"),
      m("C", "D", null, null, "scheduled"),
    ]);
    expect([...clinch.values()].every((v) => v === "open")).toBe(true);
  });

  it("grupo terminado: 1°/2° qualified, último eliminated, 3° open", () => {
    // A=9, B=6, C=3, D=0 (sin empates → sin ambigüedad de desempate).
    const clinch = computeGroupClinch([
      m("A", "B", 1, 0),
      m("A", "C", 1, 0),
      m("A", "D", 1, 0),
      m("B", "C", 1, 0),
      m("B", "D", 1, 0),
      m("C", "D", 1, 0),
    ]);
    expect(clinch.get("A")).toBe("qualified");
    expect(clinch.get("B")).toBe("qualified");
    expect(clinch.get("C")).toBe("open");
    expect(clinch.get("D")).toBe("eliminated");
  });

  it("no confía en el marcador en vivo para declarar un clinch", () => {
    // A ganó la fecha 1 (3 pts) y va ganando 5-0 en vivo, pero el resto está por
    // jugarse: no está matemáticamente clasificado.
    const clinch = computeGroupClinch([
      m("A", "B", 1, 0),
      m("A", "C", 5, 0, "live"),
      m("A", "D", null, null, "scheduled"),
      m("B", "C", null, null, "scheduled"),
      m("B", "D", null, null, "scheduled"),
      m("C", "D", null, null, "scheduled"),
    ]);
    expect(clinch.get("A")).not.toBe("qualified");
  });
});

describe("computeGroupPositionLock", () => {
  it("marca 'first' a quien ya tiene el 1° asegurado", () => {
    // A ganó sus 3 (9 pts). Nadie puede alcanzar 9 → 1° asegurado.
    const lock = computeGroupPositionLock([
      m("A", "B", 1, 0),
      m("A", "C", 1, 0),
      m("A", "D", 1, 0),
      m("B", "C", null, null, "scheduled"),
      m("B", "D", null, null, "scheduled"),
      m("C", "D", null, null, "scheduled"),
    ]);
    expect(lock.get("A")).toBe("first");
    expect(lock.get("B")).not.toBe("first");
  });

  it("marca 'second' a quien tiene el 2° exacto asegurado", () => {
    // A=9 (1°), B=6 jugó todo; C y D solo pueden llegar a 3 → B es 2° fijo.
    const lock = computeGroupPositionLock([
      m("A", "B", 1, 0),
      m("A", "C", 1, 0),
      m("A", "D", 1, 0),
      m("B", "C", 1, 0),
      m("B", "D", 1, 0),
      m("C", "D", null, null, "scheduled"),
    ]);
    expect(lock.get("A")).toBe("first");
    expect(lock.get("B")).toBe("second");
  });

  it("no fija posición cuando 1° y 2° aún pueden intercambiarse", () => {
    // A y B a 6 pts; el A-B directo decide el orden → ambos clasificados pero
    // sin posición fija.
    const lock = computeGroupPositionLock([
      m("A", "C", 1, 0),
      m("A", "D", 1, 0),
      m("B", "C", 1, 0),
      m("B", "D", 1, 0),
      m("A", "B", null, null, "scheduled"),
      m("C", "D", null, null, "scheduled"),
    ]);
    expect(lock.get("A")).toBe("none");
    expect(lock.get("B")).toBe("none");
    // pero ambos están clasificados al top-2:
    const clinch = computeGroupClinch([
      m("A", "C", 1, 0),
      m("A", "D", 1, 0),
      m("B", "C", 1, 0),
      m("B", "D", 1, 0),
      m("A", "B", null, null, "scheduled"),
      m("C", "D", null, null, "scheduled"),
    ]);
    expect(clinch.get("A")).toBe("qualified");
    expect(clinch.get("B")).toBe("qualified");
  });

  it("grupo terminado: 1°='first', 2°='second', resto 'none'", () => {
    const lock = computeGroupPositionLock([
      m("A", "B", 1, 0),
      m("A", "C", 1, 0),
      m("A", "D", 1, 0),
      m("B", "C", 1, 0),
      m("B", "D", 1, 0),
      m("C", "D", 1, 0),
    ]);
    expect(lock.get("A")).toBe("first");
    expect(lock.get("B")).toBe("second");
    expect(lock.get("C")).toBe("none");
    expect(lock.get("D")).toBe("none");
  });
});
