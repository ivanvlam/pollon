import Link from "next/link";

import { GroupCard, type GroupMatchRow } from "@/components/GroupCard";
import { createClient } from "@/lib/supabase/server";
import { computeGroupStandings, type GroupMatch } from "@/lib/standings";

export const metadata = { title: "Grupos" };

export default async function GroupsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, group_name, home_team, away_team, kickoff_at, status, home_score, away_score, is_active",
    )
    .eq("round", "group_stage")
    .order("kickoff_at", { ascending: true });

  const all = matches ?? [];
  const ids = all.map((m) => m.id);

  const { data: myPreds } = await supabase
    .from("predictions")
    .select("match_id, predicted_home, predicted_away")
    .eq("user_id", uid)
    .in("match_id", ids.length > 0 ? ids : ["x"]);
  const predByMatch = new Map((myPreds ?? []).map((p) => [p.match_id, p]));

  const { data: myScores } = await supabase
    .from("scores")
    .select("match_id, points")
    .eq("pool_id", params.id)
    .eq("user_id", uid);
  const pointsByMatch = new Map(
    (myScores ?? [])
      .filter((s) => s.match_id !== null)
      .map((s) => [s.match_id as string, s.points]),
  );

  const groups = new Map<string, typeof all>();
  for (const m of all) {
    const key = m.group_name ?? "Sin grupo";
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  const groupNames = [...groups.keys()].sort();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Grupos</h1>
        <Link
          href={`/pool/${params.id}`}
          className="text-sm text-emerald-400 hover:underline"
        >
          ← Volver al ranking
        </Link>
      </header>

      {groupNames.length === 0 && (
        <p className="text-neutral-400">Aún no hay partidos de fase de grupos.</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {groupNames.map((name) => {
          const groupMatches = groups.get(name)!;
          const standings = computeGroupStandings(groupMatches as GroupMatch[]);
          const yourPoints = groupMatches.reduce(
            (sum, m) => sum + (pointsByMatch.get(m.id) ?? 0),
            0,
          );
          const rows: GroupMatchRow[] = groupMatches.map((m) => ({
            id: m.id,
            home_team: m.home_team,
            away_team: m.away_team,
            kickoff_at: m.kickoff_at,
            status: m.status,
            home_score: m.home_score,
            away_score: m.away_score,
            is_active: m.is_active,
            pred: predByMatch.get(m.id) ?? null,
            myPoints: pointsByMatch.get(m.id),
          }));

          return (
            <GroupCard
              key={name}
              name={name}
              standings={standings}
              matches={rows}
              yourPoints={yourPoints}
            />
          );
        })}
      </div>
    </div>
  );
}
