import { fetchFixturesByDate } from "@/lib/thesportsdb";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { recalculateMatchScores } from "@/lib/scoring-service";

/**
 * Sincroniza partidos live directamente desde TheSportsDB por FECHA (eventsday).
 * Llamada desde el dashboard cuando detecta datos más antiguos que el umbral.
 * Evita depender del cron cuando cron-job.org no dispara. Usa eventsday (no
 * eventsround) porque este último devuelve un set incompleto que omite partidos
 * del día en curso.
 */
export async function syncLiveMatchesNow(): Promise<void> {
  // Hoy y ayer en UTC: cubre un partido que arrancó antes de medianoche UTC.
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const dates = [
    ...new Set([now.toISOString().slice(0, 10), yesterday.toISOString().slice(0, 10)]),
  ];

  const fixtures = await fetchFixturesByDate(dates);
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
