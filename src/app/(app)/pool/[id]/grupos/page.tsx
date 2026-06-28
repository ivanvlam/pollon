import Link from "next/link";

import { GroupCard, type GroupMatchRow } from "@/components/GroupCard";
import { MatchLiveRefresh } from "@/components/MatchLiveRefresh";
import { createClient } from "@/lib/supabase/server";
import {
  computeGroupClinch,
  computeGroupStandings,
  resolveFinalClinch,
  type GroupMatch,
} from "@/lib/standings";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: pool } = await supabase.from("pools").select("name").eq("id", params.id).maybeSingle();
  return { title: pool ? `Grupos · ${pool.name}` : "Grupos" };
}

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
      "id, group_name, home_team, away_team, kickoff_at, status, home_score, away_score, is_active, live_minute",
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

  // Pre-calcular standings para identificar los 8 mejores terceros entre todos los grupos.
  const allStandings = new Map(
    groupNames.map((name) => [
      name,
      computeGroupStandings(groups.get(name)! as GroupMatch[]),
    ]),
  );
  const thirds = groupNames.flatMap((name) => {
    const s = allStandings.get(name)!;
    return s[2] ? [s[2]] : [];
  });
  thirds.sort((a, b) => b.points - a.points || b.gd - a.gd || a.team.localeCompare(b.team));
  const qualifyingThirds = new Set(thirds.slice(0, 8).map((r) => r.team));

  // Cuando toda la fase de grupos terminó, la carrera de mejores terceros está
  // decidida: los 3° pasan a verde (clasificado) o rojo (eliminado), no amarillo.
  const groupStageComplete = all.length > 0 && all.every((m) => m.status === "finished");

  return (
    <div className="flex flex-col gap-6">
      <MatchLiveRefresh matches={all} />
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Grupos</h1>
        <Link
          href={`/pool/${params.id}`}
          className="text-sm text-neutral-400 hover:text-white"
        >
          ← Volver al ranking
        </Link>
      </header>

      {groupNames.length === 0 && (
        <p className="text-neutral-400">Aún no hay partidos de fase de grupos.</p>
      )}

      {groupNames.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-400">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-1 rounded-sm bg-emerald-500" /> Clasificado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-1 rounded-sm bg-yellow-500" /> Clasificando
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-1 rounded-sm bg-red-500/60" /> Eliminado
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {groupNames.map((name) => {
          const groupMatches = groups.get(name)!;
          const standings = allStandings.get(name)!;
          const clinch = resolveFinalClinch(
            computeGroupClinch(groupMatches as GroupMatch[]),
            standings,
            qualifyingThirds,
            groupStageComplete,
          );
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
            live_minute: m.live_minute,
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
              qualifyingThirds={qualifyingThirds}
              clinch={clinch}
            />
          );
        })}
      </div>
    </div>
  );
}
