import { fetchEventsByIds } from "@/lib/thesportsdb";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { recalculateMatchScores } from "@/lib/scoring-service";

/**
 * Sincroniza los partidos de la ventana activa directamente desde TheSportsDB,
 * consultando cada uno por su external_id (lookupevent). Llamada desde el
 * dashboard cuando los datos en vivo están viejos, como respaldo si el cron no
 * dispara. Usa lookupevent (no eventsround/eventsday) porque esos endpoints
 * devuelven sets incompletos que omiten partidos en curso.
 */
export async function syncLiveMatchesNow(): Promise<void> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 2.75 * 60 * 60 * 1000).toISOString();

  // Partidos en vivo + los de la ventana de kickoff, no finalizados.
  const [{ data: live }, { data: window }] = await Promise.all([
    supabase.from("matches").select("external_id").eq("status", "live"),
    supabase.from("matches").select("external_id")
      .gte("kickoff_at", windowStart)
      .lte("kickoff_at", windowEnd)
      .neq("status", "finished"),
  ]);

  const ids = [...new Set([...(live ?? []), ...(window ?? [])].map((m) => m.external_id))];
  if (ids.length === 0) return;

  const fixtures = await fetchEventsByIds(ids);

  if (fixtures.length > 0) {
    const externalIds = fixtures.map((f) => f.external_id);
    const { data: existing } = await supabase
      .from("matches")
      .select("id, external_id, status, home_score_90, away_score_90")
      .in("external_id", externalIds);

    const prevStatus = new Map((existing ?? []).map((m) => [m.external_id, m.status]));
    const prev90 = new Map(
      (existing ?? []).map((m) => [m.external_id, { h: m.home_score_90, a: m.away_score_90 }]),
    );
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
          home_score_90: f.home_score_90 ?? prev90.get(f.external_id)?.h ?? null,
          away_score_90: f.away_score_90 ?? prev90.get(f.external_id)?.a ?? null,
          home_pen: f.home_pen,
          away_pen: f.away_pen,
          updated_at: new Date().toISOString(),
          // Auto-activar: se abre para predecir en cuanto tiene ambos equipos
          // (grupos siempre; KO cuando el proveedor publica el cruce definido).
          ...(f.home_team && f.away_team ? { is_active: true } : {}),
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

  // Respaldo temporal: si lookupevent no entregó el estado, marcamos 'live'
  // todo partido cuyo kickoff fue hace 5 min–2.5h y siga 'scheduled'.
  const inferStart = new Date(now.getTime() - 2.5 * 60 * 60 * 1000).toISOString();
  const inferEnd = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  await supabase
    .from("matches")
    .update({ status: "live", updated_at: now.toISOString() })
    .eq("status", "scheduled")
    .gte("kickoff_at", inferStart)
    .lte("kickoff_at", inferEnd);
}
