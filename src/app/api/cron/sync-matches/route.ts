import { NextResponse, type NextRequest } from "next/server";

import { fetchWorldCupFixtures } from "@/lib/thesportsdb";
import { verifyCronSecret } from "@/lib/cron";
import { recalculateMatchScores } from "@/lib/scoring-service";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Sincroniza fixture y resultados desde API-Football.
 * - upsert en matches por external_id
 * - si un partido pasó a 'finished', recalcula sus scores
 * Corre cada 5 min durante el torneo (GitHub Actions).
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  let fixtures;
  try {
    fixtures = await fetchWorldCupFixtures();
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

  // Upsert de todos los fixtures.
  // Fase de grupos se activa automáticamente (equipos ya conocidos).
  // Eliminatorias quedan inactivas hasta que el admin las habilite manualmente.
  const { error: upsertErr } = await supabase.from("matches").upsert(
    fixtures.map((f) => ({
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
