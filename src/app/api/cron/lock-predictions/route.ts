import { NextResponse, type NextRequest } from "next/server";

import { CHAMPION_LOCK_HOURS, LOCK_HOURS_BEFORE_KICKOFF } from "@/lib/constants";
import { verifyCronSecret } from "@/lib/cron";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Bloquea (is_locked) las predicciones de partidos que cierran dentro de la
 * ventana de LOCK_HOURS_BEFORE_KICKOFF (1h). El cierre real para editar y la
 * revelación de picks ajenos se calculan por tiempo (ver submit_prediction /
 * predictions_visibility); este flag se mantiene para campeón/goleador, cuya
 * RLS de visibilidad sí lee is_locked. También cierra la predicción de campeón
 * y goleador según CHAMPION_LOCK_HOURS (hoy: 2h después del inicio del primer
 * partido del torneo). Corre cada hora.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const thresholdIso = new Date(
    now + LOCK_HOURS_BEFORE_KICKOFF * 3600_000,
  ).toISOString();

  // Partidos cuyo cierre (kickoff - 24h) ya pasó.
  const { data: matches, error: matchErr } = await supabase
    .from("matches")
    .select("id, kickoff_at")
    .lte("kickoff_at", thresholdIso);

  if (matchErr) {
    return NextResponse.json({ error: matchErr.message }, { status: 500 });
  }

  const matchIds = (matches ?? []).map((m) => m.id);
  let locked = 0;

  if (matchIds.length > 0) {
    const { data, error } = await supabase
      .from("predictions")
      .update({ is_locked: true, locked_at: nowIso })
      .in("match_id", matchIds)
      .eq("is_locked", false)
      .select("id");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    locked = data?.length ?? 0;
  }

  // Cierre de predicción de campeón/goleador (CHAMPION_LOCK_HOURS).
  const { data: firstMatch } = await supabase
    .from("matches")
    .select("kickoff_at")
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let championLocked = 0;
  let topScorerLocked = 0;
  if (firstMatch) {
    const championDeadline =
      new Date(firstMatch.kickoff_at).getTime() -
      CHAMPION_LOCK_HOURS * 3600_000;
    if (now >= championDeadline) {
      const { data: c } = await supabase
        .from("champion_predictions")
        .update({ is_locked: true, locked_at: nowIso })
        .eq("is_locked", false)
        .select("id");
      championLocked = c?.length ?? 0;

      const { data: ts } = await supabase
        .from("top_scorer_predictions")
        .update({ is_locked: true, locked_at: nowIso })
        .eq("is_locked", false)
        .select("id");
      topScorerLocked = ts?.length ?? 0;
    }
  }

  return NextResponse.json({ ok: true, locked, championLocked, topScorerLocked });
}
