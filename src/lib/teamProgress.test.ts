import { describe, expect, it } from "vitest";

import { computeTeamProgress, type KoMatchForProgress } from "@/lib/teamProgress";
import type { MatchWinner, Round } from "@/types";

function ko(
  round: Round,
  home: string,
  away: string,
  status: "scheduled" | "live" | "finished",
  winner: MatchWinner | null = null,
): KoMatchForProgress {
  return { round, home_team: home, away_team: away, status, winner };
}

describe("computeTeamProgress", () => {
  it("equipo que no clasificó del grupo → eliminado en fase de grupos", () => {
    expect(
      computeTeamProgress({ team: "Chile", qualifiedFromGroup: false, koMatches: [] }),
    ).toEqual({ label: "Eliminado en fase de grupos", kind: "out" });
  });

  it("clasificado sin cruce KO cargado todavía → clasificado a dieciseisavos", () => {
    const p = computeTeamProgress({ team: "Brazil", qualifiedFromGroup: true, koMatches: [] });
    expect(p.kind).toBe("alive");
    expect(p.label).toMatch(/dieciseisavos/i);
  });

  it("partido KO programado (no jugado) → en esa ronda", () => {
    const matches = [ko("round_of_32", "Brazil", "Japan", "scheduled")];
    const p = computeTeamProgress({ team: "Brazil", qualifiedFromGroup: true, koMatches: matches });
    expect(p).toEqual({ label: "En dieciseisavos de final", kind: "alive" });
  });

  it("ganó su dieciseisavos → clasificado a octavos", () => {
    const matches = [ko("round_of_32", "Brazil", "Japan", "finished", "home")];
    const p = computeTeamProgress({ team: "Brazil", qualifiedFromGroup: true, koMatches: matches });
    expect(p).toEqual({ label: "Clasificado a octavos de final", kind: "alive" });
  });

  it("perdió su dieciseisavos → eliminado en dieciseisavos", () => {
    const matches = [ko("round_of_32", "Brazil", "Japan", "finished", "away")];
    const p = computeTeamProgress({ team: "Brazil", qualifiedFromGroup: true, koMatches: matches });
    expect(p).toEqual({ label: "Eliminado en dieciseisavos de final", kind: "out" });
  });

  it("usa el partido más avanzado: ganó R32, juega octavos → en octavos", () => {
    const matches = [
      ko("round_of_32", "Brazil", "Japan", "finished", "home"),
      ko("round_of_16", "Brazil", "Germany", "scheduled"),
    ];
    const p = computeTeamProgress({ team: "Brazil", qualifiedFromGroup: true, koMatches: matches });
    expect(p).toEqual({ label: "En octavos de final", kind: "alive" });
  });

  it("ganó la final → campeón", () => {
    const matches = [ko("final", "Brazil", "France", "finished", "home")];
    const p = computeTeamProgress({ team: "Brazil", qualifiedFromGroup: true, koMatches: matches });
    expect(p).toEqual({ label: "Campeón", kind: "champion" });
  });

  it("perdió la final → subcampeón", () => {
    const matches = [ko("final", "Brazil", "France", "finished", "away")];
    const p = computeTeamProgress({ team: "Brazil", qualifiedFromGroup: true, koMatches: matches });
    expect(p).toEqual({ label: "Subcampeón", kind: "out" });
  });

  it("empate sin clasificado definido (winner null) → sigue en esa ronda", () => {
    const matches = [ko("quarterfinal", "Brazil", "Spain", "finished", null)];
    const p = computeTeamProgress({ team: "Brazil", qualifiedFromGroup: true, koMatches: matches });
    expect(p).toEqual({ label: "En cuartos de final", kind: "alive" });
  });

  it("ignora partidos de otros equipos", () => {
    const matches = [
      ko("round_of_32", "Argentina", "Mexico", "finished", "home"),
      ko("round_of_32", "Brazil", "Japan", "finished", "away"),
    ];
    const p = computeTeamProgress({ team: "Brazil", qualifiedFromGroup: true, koMatches: matches });
    expect(p).toEqual({ label: "Eliminado en dieciseisavos de final", kind: "out" });
  });
});
