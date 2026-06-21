import { NextResponse } from "next/server";

import { calculateMatchScore } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";
import { computeGroupClinch, computeGroupStandings, type GroupMatch } from "@/lib/standings";

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

  const matchesWithPreds = teamMatches.map((m) => ({
    ...m,
    pred: predMap[m.id] ?? null,
  }));

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

    group = {
      name: groupName.replace(/^Group\s+/i, "Grupo "),
      standings,
      matches: groupRows,
      clinch: [...computeGroupClinch(groupMatches as GroupMatch[])],
    };
  }

  return NextResponse.json({
    standing,
    matches: matchesWithPreds,
    groupName,
    position,
    group,
    qualifyingThirds,
  });
}
