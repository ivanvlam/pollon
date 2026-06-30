import { NextResponse } from "next/server";

import { calculateMatchScore, regulationScore } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";
import {
  computeGroupClinch,
  computeGroupStandings,
  resolveFinalClinch,
  type GroupMatch,
} from "@/lib/standings";
import { computeTeamProgress } from "@/lib/teamProgress";
import type { MatchWinner, Round } from "@/types";

const KO_ROUNDS: Round[] = [
  "round_of_32",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "final",
];

export async function GET(
  _req: Request,
  { params }: { params: { team: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const team = decodeURIComponent(params.team);

  const { data: allGroupMatches } = await supabase
    .from("matches")
    .select(
      "id, group_name, home_team, away_team, kickoff_at, status, home_score, away_score, is_active, live_minute",
    )
    .eq("round", "group_stage")
    .order("kickoff_at", { ascending: true });

  const all = allGroupMatches ?? [];
  const teamMatches = all.filter(
    (m) => m.home_team === team || m.away_team === team,
  );

  if (teamMatches.length === 0) {
    return NextResponse.json({
      standing: null,
      matches: [],
      groupName: null,
      position: null,
    });
  }

  const groupName = teamMatches[0]?.group_name ?? null;
  const groupMatches = groupName
    ? all.filter((m) => m.group_name === groupName)
    : [];
  const standings = computeGroupStandings(groupMatches);
  const standing = standings.find((s) => s.team === team) ?? null;
  const positionIndex = standings.findIndex((s) => s.team === team);
  const position = positionIndex >= 0 ? positionIndex + 1 : null;

  const matchIds = teamMatches.map((m) => m.id);
  const { data: preds } = await supabase
    .from("predictions")
    .select("match_id, predicted_home, predicted_away, predicted_winner, is_locked")
    .in("match_id", matchIds)
    .eq("user_id", user.id);

  const predMap = Object.fromEntries(
    (preds ?? []).map((p) => [
      p.match_id,
      {
        predicted_home: p.predicted_home,
        predicted_away: p.predicted_away,
        predicted_winner: p.predicted_winner,
        is_locked: p.is_locked,
      },
    ]),
  );

  // Puntos del usuario en un partido (mismos en cualquier polla) → calculados con
  // la función pura, igual que en la pestaña de grupos. Solo si está finalizado.
  const pointsFor = (
    round: Round,
    m: {
      status: string;
      home_score: number | null;
      away_score: number | null;
      home_score_90?: number | null;
      away_score_90?: number | null;
      winner: string | null;
    },
    pred: { predicted_home: number | null; predicted_away: number | null; predicted_winner: string | null } | null,
  ): number | undefined => {
    if (m.status !== "finished" || !pred || pred.predicted_home === null || pred.predicted_away === null) {
      return undefined;
    }
    const reg = regulationScore(m);
    const sc = calculateMatchScore(
      { round, home_score: reg.home, away_score: reg.away, winner: m.winner as MatchWinner | null },
      {
        predicted_home: pred.predicted_home,
        predicted_away: pred.predicted_away,
        predicted_winner: pred.predicted_winner as MatchWinner | null,
      },
    );
    return sc?.points ?? 0;
  };

  const matchesWithPreds = teamMatches.map((m) => {
    const pred = predMap[m.id] ?? null;
    return {
      ...m,
      pred,
      myPoints: pointsFor("group_stage", { ...m, winner: null }, pred),
    };
  });

  // ── Partidos de eliminatoria del equipo (perfil del torneo) ────────────────
  // Pocos partidos KO en total: traemos todos y filtramos en memoria (evita un
  // filtro .or con nombres de equipo).
  const { data: koAll } = await supabase
    .from("matches")
    .select(
      "id, round, home_team, away_team, kickoff_at, status, home_score, away_score, home_score_90, away_score_90, home_pen, away_pen, winner, is_active, live_minute",
    )
    .in("round", KO_ROUNDS)
    .order("kickoff_at", { ascending: true });
  const koList = (koAll ?? []).filter(
    (m) => m.home_team === team || m.away_team === team,
  );

  const koIds = koList.map((m) => m.id);
  const { data: koPreds } =
    koIds.length > 0
      ? await supabase
          .from("predictions")
          .select("match_id, predicted_home, predicted_away, predicted_winner")
          .eq("user_id", user.id)
          .in("match_id", koIds)
      : { data: [] };
  const koPredMap = new Map((koPreds ?? []).map((p) => [p.match_id, p]));

  const koWithPreds = koList.map((m) => {
    const p = koPredMap.get(m.id);
    const pred = p
      ? {
          predicted_home: p.predicted_home,
          predicted_away: p.predicted_away,
          predicted_winner: p.predicted_winner,
        }
      : null;
    return {
      id: m.id,
      round: m.round as Round,
      home_team: m.home_team,
      away_team: m.away_team,
      kickoff_at: m.kickoff_at,
      status: m.status,
      home_score: m.home_score,
      away_score: m.away_score,
      home_pen: m.home_pen,
      away_pen: m.away_pen,
      is_active: m.is_active,
      live_minute: m.live_minute,
      group_name: null as string | null,
      pred,
      myPoints: pointsFor(m.round as Round, m, pred),
    };
  });

  // Datos de la tabla del grupo (para abrir su modal desde el modal del equipo).
  let group: {
    name: string;
    standings: typeof standings;
    matches: Array<{
      id: string;
      home_team: string;
      away_team: string;
      kickoff_at: string;
      status: string;
      home_score: number | null;
      away_score: number | null;
      live_minute: string | null;
      is_active: boolean;
      pred: { predicted_home: number | null; predicted_away: number | null } | null;
      myPoints: number | undefined;
    }>;
    clinch: Array<[string, "qualified" | "eliminated" | "open"]>;
  } | null = null;
  let qualifyingThirds: string[] = [];

  if (groupName) {
    // 8 mejores terceros entre todos los grupos.
    const byGroup = new Map<string, typeof all>();
    for (const m of all) {
      if (!m.group_name) continue;
      const arr = byGroup.get(m.group_name) ?? [];
      arr.push(m);
      byGroup.set(m.group_name, arr);
    }
    const thirds = [...byGroup.keys()].flatMap((g) => {
      const s = computeGroupStandings(byGroup.get(g)! as GroupMatch[]);
      return s[2] ? [s[2]] : [];
    });
    thirds.sort((a, b) => b.points - a.points || b.gd - a.gd || a.team.localeCompare(b.team));
    qualifyingThirds = thirds.slice(0, 8).map((r) => r.team);

    // Predicciones del usuario para TODO el grupo.
    const groupIds = groupMatches.map((m) => m.id);
    const { data: gPreds } = await supabase
      .from("predictions")
      .select("match_id, predicted_home, predicted_away")
      .eq("user_id", user.id)
      .in("match_id", groupIds);
    const gPredMap = new Map((gPreds ?? []).map((p) => [p.match_id, p]));

    const groupRows = groupMatches.map((m) => {
      const p = gPredMap.get(m.id) ?? null;
      const pred = p
        ? { predicted_home: p.predicted_home, predicted_away: p.predicted_away }
        : null;
      // Puntos del partido (mismos en cualquier polla): solo si está finalizado.
      let myPoints: number | undefined;
      if (
        m.status === "finished" &&
        p &&
        p.predicted_home !== null &&
        p.predicted_away !== null
      ) {
        const sc = calculateMatchScore(
          {
            round: "group_stage",
            home_score: m.home_score,
            away_score: m.away_score,
            winner: null,
          },
          {
            predicted_home: p.predicted_home,
            predicted_away: p.predicted_away,
            predicted_winner: null,
          },
        );
        myPoints = sc?.points ?? 0;
      }
      return {
        id: m.id,
        home_team: m.home_team,
        away_team: m.away_team,
        kickoff_at: m.kickoff_at,
        status: m.status,
        home_score: m.home_score,
        away_score: m.away_score,
        live_minute: m.live_minute,
        is_active: m.is_active,
        pred,
        myPoints,
      };
    });

    const groupStageComplete = all.length > 0 && all.every((m) => m.status === "finished");
    group = {
      name: groupName.replace(/^Group\s+/i, "Grupo "),
      standings,
      matches: groupRows,
      clinch: [
        ...resolveFinalClinch(
          computeGroupClinch(groupMatches as GroupMatch[]),
          standings,
          new Set(qualifyingThirds),
          groupStageComplete,
        ),
      ],
    };
  }

  const qualifiedFromGroup =
    (position !== null && position <= 2) || qualifyingThirds.includes(team);
  const progress = computeTeamProgress({
    team,
    qualifiedFromGroup,
    koMatches: koList.map((m) => ({
      round: m.round as Round,
      home_team: m.home_team,
      away_team: m.away_team,
      status: m.status,
      winner: m.winner as MatchWinner | null,
    })),
  });

  return NextResponse.json({
    standing,
    matches: [...matchesWithPreds, ...koWithPreds],
    groupName,
    position,
    group,
    qualifyingThirds,
    progress,
  });
}
