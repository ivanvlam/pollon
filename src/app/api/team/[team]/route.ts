import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { computeGroupStandings } from "@/lib/standings";

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

  return NextResponse.json({ standing, matches: matchesWithPreds, groupName, position });
}
