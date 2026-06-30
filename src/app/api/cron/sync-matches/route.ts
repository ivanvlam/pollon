import { NextResponse, type NextRequest } from "next/server";

import { fetchEventsByIds, fetchWorldCupFixtures, type ExternalMatch } from "@/lib/thesportsdb";
import { verifyCronSecret } from "@/lib/cron";
import { reconcileKnockoutFixtures } from "@/lib/matches/reconcile";
import { recalculateMatchScores } from "@/lib/scoring-service";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Cuántos partidos tiene cada ronda eliminatoria cuando está completa, y su
 * número de ronda en TheSportsDB. Se usa para el "descubrimiento": pedir solo
 * las rondas que todavía no están completas en la DB.
 */
const KO_ROUNDS: { round: string; sdb: number; expected: number }[] = [
  { round: "round_of_32", sdb: 32, expected: 16 },
  { round: "round_of_16", sdb: 16, expected: 8 },
  { round: "quarterfinal", sdb: 125, expected: 4 },
  { round: "semifinal", sdb: 150, expected: 2 },
  { round: "final", sdb: 200, expected: 1 },
];

/**
 * Sincroniza fixture y resultados desde TheSportsDB.
 * - Descubrimiento (throttleado): redescubre las rondas KO incompletas para
 *   importar partidos nuevos que el proveedor publica después del bootstrap.
 * - Ventana: refresca el estado en vivo de los partidos en curso por external_id.
 * - upsert en matches por external_id (los ya 'finished' no se re-escriben)
 * - si un partido pasó a 'finished', recalcula sus scores
 * Corre cada 1 min (cron-job.org).
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  // Solo llamamos a la API si hay partidos live o en la ventana [-3h, +2.75h].
  // El lookback de 3h es CLAVE: cubre un partido en curso (90' + entretiempo +
  // alargue) aunque el cron se haya atrasado y todavía no lo hayamos marcado
  // 'live'. Con una ventana más corta, un partido que arrancó hace rato cae en
  // un agujero y nunca se sincroniza. Fuera de la ventana: ok sin consumir cuota.
  const now = new Date();
  const windowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 2.75 * 60 * 60 * 1000).toISOString();

  const [{ count: totalMatches }, { data: liveMatches }, { data: windowMatches }, { data: koRows }] =
    await Promise.all([
      supabase.from("matches").select("*", { count: "exact", head: true }),
      supabase.from("matches").select("external_id").eq("status", "live"),
      supabase.from("matches").select("external_id")
        .gte("kickoff_at", windowStart)
        .lte("kickoff_at", windowEnd)
        .neq("status", "finished"),
      supabase.from("matches").select("round").neq("round", "group_stage"),
    ]);

  const activeMatches = [...(liveMatches ?? []), ...(windowMatches ?? [])];
  const windowIds = [...new Set(activeMatches.map((m) => m.external_id))];

  // Si no hay partidos en la DB (primera carga), fetchear todo el fixture.
  const isBootstrap = (totalMatches ?? 0) === 0;

  // ── Descubrimiento de fixtures KO ──────────────────────────────────────────
  // El proveedor publica las eliminatorias de a poco (a medida que se definen
  // los cruces). El sync por ventana solo refresca external_id YA conocidos, así
  // que sin esto los partidos nuevos nunca entrarían. Throttle: solo cada 15 min
  // y solo las rondas incompletas (deja de pedir una ronda cuando se completa),
  // para no quemar cuota cada minuto.
  let discoveryFixtures: ExternalMatch[] = [];
  const shouldDiscover = !isBootstrap && now.getUTCMinutes() % 15 === 0;
  if (shouldDiscover) {
    const koCount = new Map<string, number>();
    for (const r of koRows ?? []) koCount.set(r.round, (koCount.get(r.round) ?? 0) + 1);
    const incompleteSdb = KO_ROUNDS
      .filter((k) => (koCount.get(k.round) ?? 0) < k.expected)
      .map((k) => k.sdb);
    if (incompleteSdb.length > 0) {
      try {
        discoveryFixtures = await fetchWorldCupFixtures(incompleteSdb);
      } catch {
        // El descubrimiento es secundario; si falla, seguimos con el sync normal.
        discoveryFixtures = [];
      }
    }
  }

  // ── Sync de la ventana activa (live scores) ────────────────────────────────
  // Consultamos cada partido de la ventana por su external_id (lookupevent), NO
  // por ronda ni por fecha. eventsround y eventsday devuelven sets incompletos
  // que omiten partidos en curso, por lo que el partido quedaba "live" congelado.
  // Bootstrap (DB vacía): fetch del fixture completo por ronda.
  let windowFixtures: ExternalMatch[] = [];
  try {
    if (isBootstrap) {
      windowFixtures = await fetchWorldCupFixtures();
    } else if (windowIds.length > 0) {
      windowFixtures = await fetchEventsByIds(windowIds);
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "api error" },
      { status: 502 },
    );
  }

  // Mergear descubrimiento + ventana, dedupe por external_id. La ventana es más
  // fresca para el estado en vivo, así que pisa al descubrimiento.
  const mergedById = new Map<string, ExternalMatch>();
  for (const f of discoveryFixtures) mergedById.set(f.external_id, f);
  for (const f of windowFixtures) mergedById.set(f.external_id, f);
  const fixtures = [...mergedById.values()];

  // Si no hubo nada que traer (sin ventana, sin descubrimiento), salir.
  if (fixtures.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, skipped: true });
  }

  // Reconciliar los KO entrantes con filas manuales existentes (re-keyea su
  // external_id en su lugar) para que el upsert de abajo no cree duplicados.
  let rekeyed = 0;
  try {
    rekeyed = await reconcileKnockoutFixtures(supabase, fixtures);
  } catch {
    rekeyed = 0;
  }

  // Estados previos para detectar transiciones a 'finished'.
  const externalIds = fixtures.map((f) => f.external_id);
  const { data: existing } = await supabase
    .from("matches")
    .select("id, external_id, status, home_score_90, away_score_90")
    .in("external_id", externalIds.length > 0 ? externalIds : ["__none__"]);

  const prevStatus = new Map(
    (existing ?? []).map((m) => [m.external_id, m.status]),
  );
  // Marcador a 90' ya capturado en vivo, para preservarlo cuando el partido
  // entra al alargue/penales (ahí el fixture trae *_90 = null).
  const prev90 = new Map(
    (existing ?? []).map((m) => [
      m.external_id,
      { h: m.home_score_90, a: m.away_score_90 },
    ]),
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
        sdb_round: f.sdb_round,
        live_minute: f.live_minute,
        // Marcador a 90': en reglamentario lo trae el fixture; pasado el
        // reglamentario viene null → conservamos el ya capturado en vivo.
        home_score_90: f.home_score_90 ?? prev90.get(f.external_id)?.h ?? null,
        away_score_90: f.away_score_90 ?? prev90.get(f.external_id)?.a ?? null,
        home_pen: f.home_pen,
        away_pen: f.away_pen,
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

  // Inferencia temporal: la clave gratuita de TheSportsDB no devuelve
  // strStatus en curso (retorna null/"NS" durante el partido), lo que haría
  // que el upsert de arriba sobreescriba 'live' → 'scheduled' en cada cron.
  // Solución: marcar directamente en la DB como 'live' todo partido cuyo
  // kickoff fue hace 5 min–2.5h y siga en estado 'scheduled'.
  // Esto también funciona cuando la API devuelve [] por límite de cuota.
  const liveInferStart = new Date(now.getTime() - 2.5 * 60 * 60 * 1000).toISOString();
  const liveInferEnd = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const { data: inferredLive } = await supabase
    .from("matches")
    .update({ status: "live", updated_at: now.toISOString() })
    .eq("status", "scheduled")
    .gte("kickoff_at", liveInferStart)
    .lte("kickoff_at", liveInferEnd)
    .select("id");

  return NextResponse.json({
    ok: true,
    synced: fixtures.length,
    discovered: discoveryFixtures.length,
    rekeyed,
    recalculated,
    markedLive: inferredLive?.length ?? 0,
  });
}
