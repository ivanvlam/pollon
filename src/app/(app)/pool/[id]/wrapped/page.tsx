import { notFound } from "next/navigation";

import { WrappedStory } from "@/components/WrappedStory";
import { ROUND_LABELS, REASON_LABELS } from "@/lib/labels";
import { computePoolStats, type StatsMember } from "@/lib/pool-stats";
import { createClient } from "@/lib/supabase/server";
import { toSpanish } from "@/lib/teamNames";
import { getWrappedGate } from "@/lib/tournament";
import {
  choosePersona,
  pickBestPrediction,
  type BestPrediction,
  type WrappedData,
} from "@/lib/wrapped";
import type { Round, ScoreReason } from "@/types";

// PostgREST corta en 1000 filas por defecto: con muchos miembros y partidos
// terminados, `scores` (miembros × partidos) supera ese tope. Paginamos con un
// orden total estable.
const PAGE_SIZE = 1000;
async function fetchAllPages<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: pool } = await supabase.from("pools").select("name").eq("id", params.id).maybeSingle();
  return { title: pool ? `Wrapped · ${pool.name}` : "Wrapped" };
}

const displayGroup = (name: string) => name.replace(/^Group\s+/i, "Grupo ");
const fmt = (h: number | null, a: number | null) =>
  h === null || a === null ? "—" : `${h}-${a}`;

export default async function WrappedPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pool } = await supabase
    .from("pools")
    .select("id, name")
    .eq("id", params.id)
    .maybeSingle();
  if (!pool) notFound();

  // El viewer debe ser miembro de la polla.
  const { data: membership } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", pool.id)
    .eq("user_id", user!.id)
    .maybeSingle();
  if (!membership) notFound();

  // El Wrapped solo se habilita al terminar el torneo (campeón + goleador
  // definidos). Antes de eso la ruta no existe — salvo para el admin, que
  // puede previsualizarlo desde el panel.
  const isAdmin = user!.email === process.env.ADMIN_EMAIL;
  const gate = await getWrappedGate(supabase);
  if (!gate.ready && !isAdmin) notFound();

  const [
    { data: ranking },
    { data: finishedMatches },
    { data: myPreds },
    { data: myScores },
    { data: championPick },
    { data: topScorerPick },
    { data: viewerProfile },
    { data: statsJson },
  ] = await Promise.all([
    supabase.rpc("get_pool_ranking", { p_pool_id: pool.id }),
    supabase
      .from("matches")
      .select("id, round, group_name, home_team, away_team, home_score, away_score, kickoff_at")
      .eq("status", "finished")
      .order("kickoff_at", { ascending: true }),
    supabase
      .from("predictions")
      .select("match_id, predicted_home, predicted_away")
      .eq("user_id", user!.id),
    supabase
      .from("scores")
      .select("match_id, points, reason")
      .eq("pool_id", pool.id)
      .eq("user_id", user!.id),
    supabase.from("champion_predictions").select("team").eq("user_id", user!.id).maybeSingle(),
    supabase
      .from("top_scorer_predictions")
      .select("player_name")
      .eq("user_id", user!.id)
      .maybeSingle(),
    supabase.from("profiles").select("timezone").eq("id", user!.id).maybeSingle(),
    supabase.rpc("get_tournament_stats"),
  ]);

  const rawStats = (statsJson ?? {}) as {
    predictions?: number;
    users?: number;
    pools?: number;
    matches_finished?: number;
  };
  const projectStats = {
    predictions: Number(rawStats.predictions ?? 0),
    users: Number(rawStats.users ?? 0),
    pools: Number(rawStats.pools ?? 0),
    matchesFinished: Number(rawStats.matches_finished ?? 0),
  };

  const rows = ranking ?? [];
  const memberCount = rows.length;
  const memberIds = rows.map((r) => r.user_id as string);
  const totals = rows.map((r) => Number(r.total));
  const topPoints = totals.length > 0 ? Math.max(...totals) : 0;
  const poolAvgPoints =
    totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;

  // ── Rank del viewer (RANK, no DENSE_RANK; mismos 5 criterios que el ranking) ──
  type RankRow = (typeof rows)[number];
  const sameScore = (a: RankRow, b: RankRow) =>
    a.total === b.total &&
    a.exact_count === b.exact_count &&
    a.diff_count === b.diff_count &&
    a.winner_count === b.winner_count &&
    a.champion_correct === b.champion_correct;

  let rank: number | null = null;
  let tied = false;
  let gi = 0;
  while (gi < rows.length) {
    let gj = gi + 1;
    while (gj < rows.length && sameScore(rows[gi]!, rows[gj]!)) gj++;
    const groupTied = gj - gi > 1;
    for (let k = gi; k < gj; k++) {
      if (rows[k]!.user_id === user!.id) {
        rank = gi + 1;
        tied = groupTied;
      }
    }
    gi = gj;
  }

  const myRow = rows.find((r) => r.user_id === user!.id) ?? null;

  // ── Stats de racha/acierto/promedio (reusa la lógica pura de la polla) ──
  const finishedList = finishedMatches ?? [];
  const finishedIds = finishedList.map((m) => m.id);
  const finishedKickoffs = Object.fromEntries(
    finishedList.map((m) => [m.id, m.kickoff_at as string]),
  );
  const meMember: StatsMember = {
    userId: user!.id,
    displayName: (myRow?.display_name as string) ?? "Tú",
    total: Number(myRow?.total ?? 0),
    exactCount: Number(myRow?.exact_count ?? 0),
    diffCount: Number(myRow?.diff_count ?? 0),
    winnerCount: Number(myRow?.winner_count ?? 0),
    championCorrect: Boolean(myRow?.champion_correct),
  };
  const stats = computePoolStats({
    members: [meMember],
    finishedMatchIds: finishedIds,
    finishedKickoffs,
    scores: (myScores ?? [])
      .filter((s) => s.match_id !== null)
      .map((s) => ({ userId: user!.id, matchId: s.match_id as string, points: s.points })),
    predictions: (myPreds ?? [])
      .filter((p) => finishedIds.includes(p.match_id))
      .map((p) => ({ userId: user!.id, matchId: p.match_id })),
  });
  const me = stats.members[0]!;

  // ── Mejor pálpito: el acierto más diferenciador ──────────────────────────
  // Prioriza los exactos donde el resto de la polla sacó mucho menos. Para eso
  // necesitamos los puntajes de TODOS los miembros por partido (no solo los
  // míos), y comparar mi puntaje contra el promedio del resto.
  const matchById = new Map(finishedList.map((m) => [m.id, m]));
  const predByMatch = new Map((myPreds ?? []).map((p) => [p.match_id, p]));

  const poolScores =
    finishedIds.length > 0 && memberIds.length > 0
      ? await fetchAllPages<{ user_id: string; match_id: string | null; points: number }>(
          (from, to) =>
            supabase
              .from("scores")
              .select("user_id, match_id, points")
              .eq("pool_id", pool.id)
              .not("match_id", "is", null)
              .order("match_id", { ascending: true })
              .order("user_id", { ascending: true })
              .range(from, to),
        )
      : [];

  // matchId → (userId → points). Los que no aparecen sacaron 0 en ese partido.
  const pointsByMatch = new Map<string, Map<string, number>>();
  for (const s of poolScores) {
    if (!s.match_id) continue;
    let inner = pointsByMatch.get(s.match_id);
    if (!inner) {
      inner = new Map();
      pointsByMatch.set(s.match_id, inner);
    }
    inner.set(s.user_id, (inner.get(s.user_id) ?? 0) + s.points);
  }
  const otherCount = Math.max(memberCount - 1, 0);

  const DATE_FMT = new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
    timeZone: viewerProfile?.timezone || "UTC",
  });

  // Candidatos: mis partidos acertados, con la brecha contra el resto.
  const myScoredMatches = (myScores ?? []).filter((s) => s.match_id !== null);
  const candidates = myScoredMatches
    .map((s) => {
      const matchId = s.match_id as string;
      const m = matchById.get(matchId);
      const p = predByMatch.get(matchId);
      if (!m || !p) return null;
      const perUser = pointsByMatch.get(matchId);
      let othersSum = 0;
      let alsoNailed = 0;
      if (perUser) {
        for (const [uid, pts] of perUser) {
          if (uid === user!.id) continue;
          othersSum += pts;
          if (pts >= s.points) alsoNailed += 1;
        }
      }
      return {
        match: m,
        pred: p,
        points: s.points,
        reason: s.reason as ScoreReason,
        isExact: s.reason === "exact_score" || s.reason === "exact_qualifier_score",
        alsoNailed,
        othersAvg: otherCount > 0 ? othersSum / otherCount : 0,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const bestIdx = pickBestPrediction(candidates);
  let bestPrediction: BestPrediction | null = null;
  if (bestIdx >= 0) {
    const c = candidates[bestIdx]!;
    bestPrediction = {
      context: c.match.group_name
        ? displayGroup(c.match.group_name)
        : ROUND_LABELS[c.match.round as Round],
      date: DATE_FMT.format(new Date(c.match.kickoff_at)),
      homeTeam: c.match.home_team,
      awayTeam: c.match.away_team,
      finalScore: fmt(c.match.home_score, c.match.away_score),
      predictedScore: fmt(c.pred.predicted_home, c.pred.predicted_away),
      points: c.points,
      reasonLabel: REASON_LABELS[c.reason] ?? "Acierto",
      isExact: c.isExact,
      alsoNailed: c.alsoNailed,
      othersAvg: c.othersAvg,
    };
  }

  // ── Apuestas especiales ──
  const championScore = (myScores ?? []).find((s) => s.reason === "champion");
  const topScorerScore = (myScores ?? []).find((s) => s.reason === "top_scorer");
  const champion = championPick?.team
    ? {
        pick: toSpanish(championPick.team),
        correct: Boolean(championScore),
        points: championScore?.points ?? 0,
      }
    : null;
  const topScorer = topScorerPick?.player_name
    ? {
        pick: topScorerPick.player_name,
        correct: Boolean(topScorerScore),
        points: topScorerScore?.points ?? 0,
      }
    : null;

  // ── Ganador de la polla + torneo terminado ──
  const poolWinner = rows[0]
    ? { name: rows[0].display_name as string, isMe: rows[0].user_id === user!.id }
    : null;
  const tournamentFinished = finishedList.some((m) => m.round === "final");

  const persona = choosePersona({
    rank,
    memberCount,
    championCorrect: meMember.championCorrect,
    exactCount: meMember.exactCount,
    longestStreak: me.longestStreak,
    accuracy: me.accuracy,
    predictionCount: me.predictedFinished,
  });

  const data: WrappedData = {
    poolName: pool.name,
    displayName: meMember.displayName,
    memberCount,
    rank,
    tied,
    total: meMember.total,
    topPoints,
    poolAvgPoints,
    beatCount: totals.filter((t) => t < meMember.total).length,
    pointsBehindLeader: Math.max(0, topPoints - meMember.total),
    exactCount: meMember.exactCount,
    diffCount: meMember.diffCount,
    winnerCount: meMember.winnerCount,
    predictionCount: me.predictedFinished,
    longestStreak: me.longestStreak,
    accuracy: me.accuracy,
    avgPerPredicted: me.avgPerPredicted,
    bestPrediction,
    champion,
    topScorer,
    poolWinner,
    tournamentFinished,
    persona,
    projectStats,
  };

  return <WrappedStory data={data} />;
}
