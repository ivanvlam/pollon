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
      "id, group_name, home_team, away_team, kickoff_at, status, home_score, away_score",
    )
    .eq("round", "group_stage")
    .order("kickoff_at", { ascending: true });

  const all = allGroupMatches ?? [];
  const teamMatches = all.filter(
    (m) => m.home_team === team || m.away_team === team,
  );

  if (teamMatches.length === 0) {
    return NextResponse.json({ standing: null, matches: [], groupName: null });
  }

  const groupName = teamMatches[0]?.group_name ?? null;
  const groupMatches = groupName
    ? all.filter((m) => m.group_name === groupName)
    : [];
  const standings = computeGroupStandings(groupMatches);
  const standing = standings.find((s) => s.team === team) ?? null;

  return NextResponse.json({ standing, matches: teamMatches, groupName });
}
