import Link from "next/link";
import { notFound } from "next/navigation";

import {
  RankingHistoryChart,
  type ChartMember,
  type HistoryPoint,
} from "@/components/RankingHistoryChart";
import { createClient } from "@/lib/supabase/server";
import { toSpanish } from "@/lib/teamNames";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: pool } = await supabase.from("pools").select("name").eq("id", params.id).maybeSingle();
  return { title: pool ? `Historial · ${pool.name}` : "Historial" };
}

export default async function PoolHistorialPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: pool } = await supabase
    .from("pools")
    .select("id, name")
    .eq("id", params.id)
    .maybeSingle();
  if (!pool) notFound();

  const [{ data: ranking }, { data: allScores }] = await Promise.all([
    supabase.rpc("get_pool_ranking", { p_pool_id: pool.id }),
    supabase
      .from("scores")
      .select("user_id, match_id, points")
      .eq("pool_id", pool.id)
      .not("match_id", "is", null),
  ]);

  const { data: finishedMatches } = await supabase
    .from("matches")
    .select("id, home_team, away_team, kickoff_at, home_score, away_score")
    .eq("status", "finished")
    .order("kickoff_at", { ascending: true });

  const members: ChartMember[] = (ranking ?? []).map((r, i) => ({
    id: r.user_id,
    name: r.display_name as string,
    currentRank: i + 1,
    currentPoints: r.total as number,
  }));
  const memberIds = members.map((m) => m.id);

  const scoreMap = new Map<string, Map<string, number>>();
  for (const s of allScores ?? []) {
    const mid = s.match_id as string;
    if (!scoreMap.has(mid)) scoreMap.set(mid, new Map());
    scoreMap.get(mid)!.set(s.user_id, s.points);
  }

  const running: Record<string, number> = Object.fromEntries(
    memberIds.map((id) => [id, 0]),
  );
  const history: HistoryPoint[] = [];

  for (const m of finishedMatches ?? []) {
    const matchScores = scoreMap.get(m.id) ?? new Map<string, number>();
    const earned: Record<string, number> = {};
    for (const uid of memberIds) {
      const pts = matchScores.get(uid) ?? 0;
      earned[uid] = pts;
      running[uid] = (running[uid] ?? 0) + pts;
    }

    const sorted = [...memberIds].sort((a, b) => {
      const diff = (running[b] ?? 0) - (running[a] ?? 0);
      if (diff !== 0) return diff;
      const na = members.find((x) => x.id === a)?.name ?? "";
      const nb = members.find((x) => x.id === b)?.name ?? "";
      return na.localeCompare(nb);
    });
    const rankMap: Record<string, number> = {};
    sorted.forEach((uid, i) => {
      rankMap[uid] = i + 1;
    });

    history.push({
      label: `${toSpanish(m.home_team).slice(0, 3)}-${toSpanish(m.away_team).slice(0, 3)}`,
      fullLabel: `${toSpanish(m.home_team)} vs ${toSpanish(m.away_team)}`,
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      kickoffAt: m.kickoff_at,
      homeScore: m.home_score,
      awayScore: m.away_score,
      rankings: rankMap,
      pointsEarned: earned,
      cumulativePoints: { ...running },
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        href={`/pool/${pool.id}`}
        className="text-sm text-neutral-400 hover:text-white"
      >
        ← Volver al ranking
      </Link>

      <header>
        <h1 className="text-xl font-bold">{pool.name}</h1>
        <p className="mt-0.5 text-sm text-neutral-500">
          Historial de posiciones por partido
        </p>
      </header>

      {history.length < 2 ? (
        <p className="text-neutral-400">
          El historial aparece cuando hay al menos 2 partidos terminados.
        </p>
      ) : (
        <RankingHistoryChart history={history} members={members} />
      )}
    </div>
  );
}
