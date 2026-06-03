// ============================================================
// Pollon — Servicio de recálculo de scores (servidor)
// ============================================================
// Usa la función pura scoring.ts y persiste atómicamente vía la RPC
// replace_match_scores. Solo se ejecuta del lado servidor con el
// service role (cron / admin).

import { CHAMPION_POINTS } from "@/lib/constants";
import { calculateMatchScore } from "@/lib/scoring";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { MatchWinner, Round } from "@/types";

export interface RecalcResult {
  matchId: string;
  inserted: number;
  skipped?: string;
}

/**
 * Recalcula y reescribe los scores de un partido finalizado.
 * Una fila de score por (usuario, polla) para cada predicción puntuable.
 */
export async function recalculateMatchScores(
  matchId: string,
): Promise<RecalcResult> {
  const supabase = createServiceRoleClient();

  const { data: match } = await supabase
    .from("matches")
    .select("id, round, status, home_team, away_team, home_score, away_score, winner")
    .eq("id", matchId)
    .maybeSingle();

  if (!match) return { matchId, inserted: 0, skipped: "match not found" };
  if (match.status !== "finished" || match.home_score === null) {
    return { matchId, inserted: 0, skipped: "match not finished" };
  }

  const { data: predictions } = await supabase
    .from("predictions")
    .select("user_id, predicted_home, predicted_away, predicted_winner")
    .eq("match_id", matchId);

  const preds = predictions ?? [];
  const userIds = [...new Set(preds.map((p) => p.user_id))];

  // Membresías de todos los usuarios que predijeron este partido.
  const { data: memberships } = await supabase
    .from("pool_members")
    .select("user_id, pool_id")
    .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const poolsByUser = new Map<string, string[]>();
  for (const m of memberships ?? []) {
    const list = poolsByUser.get(m.user_id) ?? [];
    list.push(m.pool_id);
    poolsByUser.set(m.user_id, list);
  }

  const rows: {
    user_id: string;
    pool_id: string;
    points: number;
    reason: string;
  }[] = [];

  for (const pred of preds) {
    const score = calculateMatchScore(
      {
        round: match.round as Round,
        home_score: match.home_score,
        away_score: match.away_score,
        winner: match.winner as MatchWinner | null,
      },
      {
        predicted_home: pred.predicted_home,
        predicted_away: pred.predicted_away,
        predicted_winner: pred.predicted_winner as MatchWinner | null,
      },
    );
    if (!score) continue;

    for (const poolId of poolsByUser.get(pred.user_id) ?? []) {
      rows.push({
        user_id: pred.user_id,
        pool_id: poolId,
        points: score.points,
        reason: score.reason,
      });
    }
  }

  const { error } = await supabase.rpc("replace_match_scores", {
    p_match_id: matchId,
    p_scores: rows,
  });

  if (error) {
    throw new Error(`replace_match_scores falló: ${error.message}`);
  }

  // Si terminó la final, el campeón quedó definido: recalcular esos puntos.
  if (match.round === "final" && match.winner !== null) {
    const championTeam =
      match.winner === "home" ? match.home_team : match.away_team;
    await recalculateChampionScores(championTeam);
  }

  return { matchId, inserted: rows.length };
}

/**
 * Recalcula los puntos de campeón a nivel global. Otorga CHAMPION_POINTS
 * por cada polla a los usuarios que acertaron el campeón del torneo.
 * Idempotente: borra todos los scores de campeón y reinserta desde cero.
 */
export async function recalculateChampionScores(
  championTeam: string,
): Promise<{ inserted: number }> {
  const supabase = createServiceRoleClient();

  const { data: picks } = await supabase
    .from("champion_predictions")
    .select("user_id")
    .eq("team", championTeam);

  const winners = picks ?? [];
  const userIds = [...new Set(winners.map((p) => p.user_id))];

  const { data: memberships } = await supabase
    .from("pool_members")
    .select("user_id, pool_id")
    .in(
      "user_id",
      userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"],
    );

  const rows = (memberships ?? []).map((m) => ({
    user_id: m.user_id,
    pool_id: m.pool_id,
    points: CHAMPION_POINTS,
    reason: "champion" as const,
  }));

  const { error } = await supabase.rpc("replace_champion_scores", {
    p_scores: rows,
  });

  if (error) {
    throw new Error(`replace_champion_scores falló: ${error.message}`);
  }

  return { inserted: rows.length };
}
