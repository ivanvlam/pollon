import { NextResponse, type NextRequest } from "next/server";

import { fetchWorldCupFixtures } from "@/lib/thesportsdb";
import { verifyCronSecret } from "@/lib/cron";
import { recalculateMatchScores } from "@/lib/scoring-service";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Sincroniza fixture y resultados desde TheSportsDB.
 * - upsert en matches por external_id (los ya 'finished' no se re-escriben)
 * - si un partido pasó a 'finished', recalcula sus scores
 * Corre cada 15 min durante el torneo (GitHub Actions).
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  // Solo llamamos a la API si hay partidos live o en la ventana [-3h, +2h].
  // Fuera de esa ventana devolvemos ok sin consumir cuota.
  const now = new Date();
  const windowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

  const [{ count: totalMatches }, { data: liveMatches }, { data: windowMatches }] = await Promise.all([
    supabase.from("matches").select("*", { count: "exact", head: true }),
    supabase.from("matches").select("round").eq("status", "live"),
    supabase.from("matches").select("round")
      .gte("kickoff_at", windowStart)
      .lte("kickoff_at", windowEnd)
      .neq("status", "finished"),
  ]);

  const activeRounds = new Set([
    ...(liveMatches ?? []).map((m) => m.round),
    ...(windowMatches ?? []).map((m) => m.round),
  ]);

  // Si no hay partidos en la DB (primera carga), fetchear todo el fixture.
  // Si hay partidos pero ninguno en ventana activa, salir sin llamar a la API.
  const isBootstrap = (totalMatches ?? 0) === 0;
  if (!isBootstrap && activeRounds.size === 0) {
    return NextResponse.json({ ok: true, synced: 0, skipped: true });
  }

  // Mapea los rounds de la app a los números de ronda de TheSportsDB.
  const ROUND_TO_SDB: Record<string, number[]> = {
    group_stage: [1, 2, 3],
    round_of_32: [32],
    round_of_16: [16],
    quarterfinal: [125],
    semifinal: [150],
    final: [200],
  };
  // Bootstrap: pedir todas las rondas. Normal: solo las activas.
  const sdbRounds = isBootstrap
    ? undefined
    : [...activeRounds].flatMap((r) => ROUND_TO_SDB[r] ?? []);

  let fixtures;
  try {
    fixtures = await fetchWorldCupFixtures(sdbRounds);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "api error" },
      { status: 502 },
    );
  }

  // Estados previos para detectar transiciones a 'finished'.
  const externalIds = fixtures.map((f) => f.external_id);
  const { data: existing } = await supabase
    .from("matches")
    .select("id, external_id, status")
    .in("external_id", externalIds.length > 0 ? externalIds : ["__none__"]);

  const prevStatus = new Map(
    (existing ?? []).map((m) => [m.external_id, m.status]),
  );

  // Una vez que un partido está 'finished', el resultado lo gobierna el admin
  // (la API gratuita no entrega el ganador por penales: deriveWinner devuelve
  // null en empate a 90', borrando un winner puesto a mano). No re-escribimos
  // partidos ya finalizados; las transiciones a 'finished' sí se procesan.
  const toUpsert = fixtures.filter(
    (f) => prevStatus.get(f.external_id) !== "finished",
  );

  // Upsert de los fixtures no finalizados.
  // Fase de grupos se activa automáticamente (equipos ya conocidos).
  // Eliminatorias quedan inactivas hasta que el admin las habilite manualmente.
  if (toUpsert.length > 0) {
    const { error: upsertErr } = await supabase.from("matches").upsert(
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
        updated_at: new Date().toISOString(),
        ...(f.round === "group_stage" ? { is_active: true } : {}),
      })),
      { onConflict: "external_id" },
    );

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }
  }

  // Recalcular los que recién pasaron a 'finished'.
  const newlyFinished = fixtures.filter(
    (f) => f.status === "finished" && prevStatus.get(f.external_id) !== "finished",
  );

  // Necesitamos los ids internos de los recién finalizados.
  let recalculated = 0;
  if (newlyFinished.length > 0) {
    const finishedExternalIds = newlyFinished.map((f) => f.external_id);
    const { data: finishedMatches } = await supabase
      .from("matches")
      .select("id")
      .in("external_id", finishedExternalIds);

    for (const m of finishedMatches ?? []) {
      await recalculateMatchScores(m.id);
      recalculated += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    synced: fixtures.length,
    recalculated,
  });
}
