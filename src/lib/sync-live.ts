import { fetchWorldCupFixtures } from "@/lib/thesportsdb";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { recalculateMatchScores } from "@/lib/scoring-service";

const ROUND_TO_SDB: Record<string, number> = {
  round_of_32: 32,
  round_of_16: 16,
  quarterfinal: 125,
  semifinal: 150,
  final: 200,
};

/**
 * Sincroniza partidos live directamente desde TheSportsDB.
 * Llamada desde el dashboard cuando detecta datos más antiguos que el umbral.
 * Evita depender del cron cuando cron-job.org no dispara.
 */
export async function syncLiveMatchesNow(
  liveMatches: Array<{ round: string; sdb_round: number | null }>,
): Promise<void> {
  const sdbSet = new Set<number>();
  for (const m of liveMatches) {
    if (m.sdb_round != null) sdbSet.add(m.sdb_round);
    else if (m.round === "group_stage") [1, 2, 3].forEach((r) => sdbSet.add(r));
    else {
      const derived = ROUND_TO_SDB[m.round];
      if (derived) sdbSet.add(derived);
    }
  }

  const sdbRounds = sdbSet.size > 0 ? [...sdbSet] : undefined;
  const fixtures = await fetchWorldCupFixtures(sdbRounds);
  if (fixtures.length === 0) return;

  const supabase = createServiceRoleClient();
  const externalIds = fixtures.map((f) => f.external_id);
  const { data: existing } = await supabase
    .from("matches")
    .select("id, external_id, status")
    .in("external_id", externalIds.length > 0 ? externalIds : ["__none__"]);

  const prevStatus = new Map((existing ?? []).map((m) => [m.external_id, m.status]));
  const toUpsert = fixtures.filter((f) => prevStatus.get(f.external_id) !== "finished");

  if (toUpsert.length > 0) {
    await supabase.from("matches").upsert(
      toUpsert.map((f) => ({
        external_id: f.external_id,
        round: f.round,
        group_name: f.group_name,
        home_team: f.home_team,
        away_team: f.away_team,
        kickoff_at: f.kickoff_at,
        status: f.status,
        home_score: f.home_score,
        away_score: f.away_score,
        winner: f.winner,
        sdb_round: f.sdb_round,
        live_minute: f.live_minute,
        updated_at: new Date().toISOString(),
        ...(f.round === "group_stage" ? { is_active: true } : {}),
      })),
      { onConflict: "external_id" },
    );
  }

  const newlyFinished = fixtures.filter(
    (f) => f.status === "finished" && prevStatus.get(f.external_id) !== "finished",
  );
  if (newlyFinished.length > 0) {
    const { data: finishedMatches } = await supabase
      .from("matches")
      .select("id")
      .in("external_id", newlyFinished.map((f) => f.external_id));
    for (const m of finishedMatches ?? []) {
      await recalculateMatchScores(m.id);
    }
  }
}
