import { NextResponse, type NextRequest } from "next/server";

import { fetchEventsByIds, fetchEventsByName, fetchWorldCupFixtures, type ExternalMatch } from "@/lib/thesportsdb";
import { verifyCronSecret } from "@/lib/cron";
import { reconcileKnockoutFixtures, teamPairKey } from "@/lib/matches/reconcile";
import { buildStandingsByGroup, resolveBracket } from "@/lib/matches/resolveBracket";
import { resolveScore90 } from "@/lib/matches/score90";
import { recalculateMatchScores } from "@/lib/scoring-service";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Round } from "@/types";

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
  { round: "third_place", sdb: 160, expected: 1 },
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

  // El cron pega cada minuto, pero la gran mayoría del mes no hay ningún partido
  // en juego ni próximo. En Fluid, cada invocación factura por el tiempo que la
  // función espera I/O, así que un minuto ocioso debe costar lo mínimo: UNA sola
  // query y salir. Todo el trabajo pesado (auto-activar KO, descubrimiento, sync,
  // inferencia de 'live') queda detrás de la guarda de abajo y solo corre cuando
  // hay un partido activo o en la pasada de descubrimiento (cada 1 hora).
  const now = new Date();
  const windowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 2.75 * 60 * 60 * 1000).toISOString();
  // Descubrimiento: una vez por hora (en el minuto 0). Antes cada 15 min.
  // `?discover=1` (protegido por el mismo CRON_SECRET) lo fuerza a demanda, para
  // importar cruces recién definidos sin esperar al próximo minuto 0.
  const forceDiscover = request.nextUrl.searchParams.get("discover") === "1";
  const isDiscoveryMinute = now.getUTCMinutes() === 0 || forceDiscover;

  // Partidos "activos": live, o con kickoff en la ventana [-3h, +2.75h]. El
  // lookback de 3h es CLAVE: cubre un partido en curso (90' + entretiempo +
  // alargue) aunque el cron se haya atrasado y todavía no lo hayamos marcado
  // 'live'. Una sola query (OR) resuelve ambos casos → es el único costo de un
  // minuto ocioso. Los timestamps van entre comillas por los caracteres
  // reservados de PostgREST dentro de or()/and().
  const { data: activeRows } = await supabase
    .from("matches")
    .select("external_id")
    .or(
      `status.eq.live,and(kickoff_at.gte."${windowStart}",kickoff_at.lte."${windowEnd}")`,
    )
    .neq("status", "finished");

  const windowIds = [...new Set((activeRows ?? []).map((m) => m.external_id))];

  // ── Camino ocioso barato ────────────────────────────────────────────────
  // Sin partidos activos y fuera de la pasada de descubrimiento: no hay nada que
  // sincronizar. Salir ya, con un solo SELECT hecho. Aquí vive el ahorro de CPU:
  // casi todos los minutos del mes caen en esta rama.
  if (windowIds.length === 0 && !isDiscoveryMinute) {
    return NextResponse.json({ ok: true, synced: 0, idle: true });
  }

  // A partir de acá SÍ hay trabajo (partido activo o pasada de descubrimiento).

  // Auto-activar eliminatorias: cualquier partido KO inactivo que YA tenga ambos
  // equipos definidos se abre para predecir. No necesita correr cada minuto (una
  // predicción cierra 1h antes de su kickoff), así que basta con hacerlo cuando
  // ya estamos haciendo trabajo: cubre los cargados a mano y los importados antes
  // de que el sync auto-activara, aunque su ronda ya no se re-fetchee.
  await supabase
    .from("matches")
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq("is_active", false)
    .neq("status", "finished")
    .neq("round", "group_stage")
    .neq("home_team", "")
    .neq("away_team", "");

  // ¿DB vacía? (primera carga) → bootstrap del fixture completo. Solo puede pasar
  // cuando no hay ningún partido activo (windowIds vacío), así que evitamos el
  // count en el caso común (partido en juego ⇒ la DB claramente no está vacía).
  let isBootstrap = false;
  if (windowIds.length === 0) {
    const { count: totalMatches } = await supabase
      .from("matches")
      .select("*", { count: "exact", head: true });
    isBootstrap = (totalMatches ?? 0) === 0;
  }

  // ── Descubrimiento de fixtures KO ──────────────────────────────────────────
  // El proveedor publica las eliminatorias de a poco (a medida que se definen
  // los cruces). El sync por ventana solo refresca external_id YA conocidos, así
  // que sin esto los partidos nuevos nunca entrarían. Throttle: solo cada 1 hora
  // para no quemar cuota. Dos vías:
  //   1) eventsround de las rondas incompletas (barato, pero en la clave gratuita
  //      queda CACHEADO: los cruces que el proveedor publica después NO aparecen).
  //   2) searchevents POR NOMBRE de cada partido manual pendiente (manual-*): es
  //      la vía fresca. eventsround puede ignorar para siempre un cruce nuevo, pero
  //      searchevents lo devuelve en cuanto existe. reconcile lo adopta (re-keya el
  //      manual-* al id real) → de ahí en más el sync normal lo gobierna.
  let discoveryFixtures: ExternalMatch[] = [];
  const shouldDiscover = !isBootstrap && isDiscoveryMinute;
  if (shouldDiscover) {
    // Una sola lectura de todos los KO + los partidos de grupo, para: (a) contar
    // rondas incompletas, (b) reconciliar manuales pendientes, y (c) resolver el
    // bracket y detectar cruces YA definidos que todavía no están en la DB.
    const [{ data: koRowsAll }, { data: groupRows }] = await Promise.all([
      supabase
        .from("matches")
        .select("id, external_id, round, home_team, away_team, status, winner")
        .neq("round", "group_stage"),
      supabase
        .from("matches")
        .select("group_name, home_team, away_team, home_score, away_score, status")
        .eq("round", "group_stage"),
    ]);
    const koRows = koRowsAll ?? [];

    // (a) eventsround de las rondas incompletas. Cuenta SOLO filas reales: una
    // fila manual-* es un placeholder que aún espera el fixture del proveedor; si
    // contara, la ronda se daría por completa y dejaría de pedirse → el cruce real
    // nunca entraría y reconcile nunca lo adoptaría (quedaría manual para siempre).
    const koCount = new Map<string, number>();
    for (const r of koRows) {
      if (!r.external_id.startsWith("manual-")) koCount.set(r.round, (koCount.get(r.round) ?? 0) + 1);
    }
    const incompleteSdb = KO_ROUNDS
      .filter((k) => (koCount.get(k.round) ?? 0) < k.expected)
      .map((k) => k.sdb);

    // (b) Manuales sin reconciliar → buscar por nombre, FORZANDO su ronda.
    const manualPairs = koRows
      .filter((r) => r.external_id.startsWith("manual-") && r.home_team && r.away_team)
      .map((r) => ({ home: r.home_team, away: r.away_team, round: r.round as Round }));

    // (c) Cruces ya definidos por el bracket que todavía no están en la DB. El
    // proveedor publica algunos KO con intRound=0 y fuera de eventsround (ej. el
    // cuarto Francia-Marruecos), así que eventsround no los trae. Los buscamos por
    // nombre forzando la ronda que dicta el esquema: apenas terminan los dos
    // partidos que alimentan un cruce, este entra y se auto-activa para predecir.
    const resolved = resolveBracket(buildStandingsByGroup(groupRows ?? []), koRows);
    const resolvedPairs = [...resolved.values()]
      .filter((s) => s.homeTeam && s.awayTeam && !s.dbMatch)
      .map((s) => ({ home: s.homeTeam!, away: s.awayTeam!, round: s.round }));

    // Dedupe por {ronda + par sin orden}.
    const pairByKey = new Map<string, { home: string; away: string; round: Round }>();
    for (const p of [...manualPairs, ...resolvedPairs]) {
      pairByKey.set(`${p.round}::${teamPairKey(p.home, p.away)}`, p);
    }
    const namePairs = [...pairByKey.values()];

    const [roundFx, nameFx] = await Promise.all([
      incompleteSdb.length > 0
        ? fetchWorldCupFixtures(incompleteSdb).catch(() => [] as ExternalMatch[])
        : Promise.resolve([] as ExternalMatch[]),
      namePairs.length > 0
        ? fetchEventsByName(namePairs).catch(() => [] as ExternalMatch[])
        : Promise.resolve([] as ExternalMatch[]),
    ]);
    // searchevents es más fresco que eventsround → que pise en el merge.
    const merged = new Map<string, ExternalMatch>();
    for (const f of roundFx) merged.set(f.external_id, f);
    for (const f of nameFx) merged.set(f.external_id, f);
    discoveryFixtures = [...merged.values()];
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
    .select("id, external_id, status, home_score_90, away_score_90, reached_extra_time")
    .in("external_id", externalIds.length > 0 ? externalIds : ["__none__"]);

  const prevStatus = new Map(
    (existing ?? []).map((m) => [m.external_id, m.status]),
  );
  // Estado previo del marcador a 90' para preservarlo cuando el partido pasa al
  // alargue/penales. reached_extra_time da MEMORIA: una vez visto un poll pasado
  // del reglamentario, el 90' queda congelado aunque el cierre venga como 'FT'
  // (la clave gratuita no siempre reporta 'AET'). Ver resolveScore90.
  const prev90 = new Map(
    (existing ?? []).map((m) => [
      m.external_id,
      {
        home_score_90: m.home_score_90,
        away_score_90: m.away_score_90,
        reached_extra_time: m.reached_extra_time ?? false,
      },
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
      toUpsert.map((f) => {
        // Marcador a 90': en reglamentario sigue al fixture; pasado el
        // reglamentario (ahora o en un poll previo) queda congelado y no lo
        // pisa el marcador de cancha aunque el cierre venga como 'FT'.
        const s90 = resolveScore90(prev90.get(f.external_id), f);
        return {
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
        home_score_90: s90.home_score_90,
        away_score_90: s90.away_score_90,
        reached_extra_time: s90.reached_extra_time,
        home_pen: f.home_pen,
        away_pen: f.away_pen,
        updated_at: new Date().toISOString(),
        // Auto-activar: un partido se abre para predecir en cuanto tiene ambos
        // equipos definidos. En grupos siempre; en eliminatorias, el proveedor
        // solo publica el cruce cuando se define (ambos equipos reales), así que
        // se activa solo (antes los KO quedaban inactivos hasta habilitarlos a
        // mano). No se desactiva nada: solo se setea true cuando hay equipos.
        ...(f.home_team && f.away_team ? { is_active: true } : {}),
        };
      }),
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
  //
  // EXCLUIR partidos manuales (external_id 'manual-*'): la API no puede
  // resolver su id (fetchEventsByIds no los trae), así que nunca recibirían
  // ni marcador ni la transición a 'finished'. Si los marcáramos 'live' se
  // quedarían pegados en un 0-0 falso "EN VIVO" para siempre. Un partido
  // manual solo termina cuando el admin carga el resultado (saveMatchResult) o
  // cuando el proveedor publica el cruce y reconcileKnockoutFixtures lo re-keya.
  const liveInferStart = new Date(now.getTime() - 2.5 * 60 * 60 * 1000).toISOString();
  const liveInferEnd = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const { data: inferredLive } = await supabase
    .from("matches")
    .update({ status: "live", updated_at: now.toISOString() })
    .eq("status", "scheduled")
    .gte("kickoff_at", liveInferStart)
    .lte("kickoff_at", liveInferEnd)
    .not("external_id", "like", "manual-%")
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
