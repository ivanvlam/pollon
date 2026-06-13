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
      .select("user_id, match_id, points, reason")
      .eq("pool_id", pool.id)
      .not("match_id", "is", null),
  ]);

  const { data: finishedMatches } = await supabase
    .from("matches")
    .select("id, home_team, away_team, kickoff_at, home_score, away_score")
    .eq("status", "finished")
    .order("kickoff_at", { ascending: true });

  const rankingRows = ranking ?? [];
  const currentRanks: number[] = [];
  {
    let ri = 0;
    while (ri < rankingRows.length) {
      let rj = ri + 1;
      const a = rankingRows[ri]!;
      while (rj < rankingRows.length) {
        const b = rankingRows[rj]!;
        if (
          a.total === b.total &&
          a.exact_count === b.exact_count &&
          a.diff_count === b.diff_count &&
          a.winner_count === b.winner_count &&
          a.champion_correct === b.champion_correct
        ) { rj++; } else break;
      }
      for (let k = ri; k < rj; k++) currentRanks.push(ri + 1);
      ri = rj;
    }
  }

  const members: ChartMember[] = rankingRows.map((r, i) => ({
    id: r.user_id,
    name: r.display_name as string,
    currentRank: currentRanks[i]!,
    currentPoints: r.total as number,
  }));
  const memberIds = members.map((m) => m.id);

  const finishedMatchIds = (finishedMatches ?? []).map((m) => m.id);
  const { data: memberPredictions } =
    finishedMatchIds.length > 0 && memberIds.length > 0
      ? await supabase
          .from("predictions")
          .select("user_id, match_id, predicted_home, predicted_away, predicted_winner")
          .in("match_id", finishedMatchIds)
          .in("user_id", memberIds)
      : { data: [] };

  const predMap = new Map<
    string,
    Map<string, { home: number | null; away: number | null; winner: string | null }>
  >();
  for (const p of memberPredictions ?? []) {
    if (!predMap.has(p.match_id)) predMap.set(p.match_id, new Map());
    predMap.get(p.match_id)!.set(p.user_id, {
      home: p.predicted_home,
      away: p.predicted_away,
      winner: p.predicted_winner,
    });
  }

  type ScoreEntry = { points: number; reason: string | null };
  const scoreMap = new Map<string, Map<string, ScoreEntry>>();
  for (const s of allScores ?? []) {
    const mid = s.match_id as string;
    if (!scoreMap.has(mid)) scoreMap.set(mid, new Map());
    scoreMap.get(mid)!.set(s.user_id, { points: s.points, reason: s.reason as string | null });
  }

  type RunningStats = { total: number; exact: number; diff: number; winner: number };
  const running: Record<string, RunningStats> = Object.fromEntries(
    memberIds.map((id) => [id, { total: 0, exact: 0, diff: 0, winner: 0 }]),
  );
  const memberName = new Map(members.map((m) => [m.id, m.name]));
  const history: HistoryPoint[] = [];

  for (const m of finishedMatches ?? []) {
    const matchData = scoreMap.get(m.id) ?? new Map<string, ScoreEntry>();
    const earned: Record<string, number> = {};
    for (const uid of memberIds) {
      const entry = matchData.get(uid);
      const pts = entry?.points ?? 0;
      const reason = entry?.reason ?? null;
      earned[uid] = pts;
      const r = running[uid]!;
      r.total += pts;
      if (reason === "exact_score" || reason === "exact_qualifier_score") r.exact++;
      else if (reason === "correct_diff" || reason === "correct_diff_qualifier") r.diff++;
      else if (reason === "correct_winner" || reason === "correct_draw" || reason === "correct_qualifier") r.winner++;
    }

    const sorted = [...memberIds].sort((a, b) => {
      const ra = running[a]!;
      const rb = running[b]!;
      if (rb.total !== ra.total) return rb.total - ra.total;
      if (rb.exact !== ra.exact) return rb.exact - ra.exact;
      if (rb.diff !== ra.diff) return rb.diff - ra.diff;
      if (rb.winner !== ra.winner) return rb.winner - ra.winner;
      return (memberName.get(a) ?? "").localeCompare(memberName.get(b) ?? "");
    });
    const rankMap: Record<string, number> = {};
    sorted.forEach((uid, i) => { rankMap[uid] = i + 1; });

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
      cumulativePoints: Object.fromEntries(memberIds.map((id) => [id, running[id]!.total])),
      cumulativeStats: Object.fromEntries(memberIds.map((id) => [id, { ...running[id]! }])),
      predictions: Object.fromEntries(
        memberIds.map((uid) => [uid, predMap.get(m.id)?.get(uid) ?? null]),
      ),
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
