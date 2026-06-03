import { NextResponse, type NextRequest } from "next/server";

import { verifyCronSecret } from "@/lib/cron";
import { recalculateMatchScores } from "@/lib/scoring-service";

export const dynamic = "force-dynamic";

/**
 * Recalcula los scores de un partido. Body: { matchId: string }.
 * Llamado por sync-matches al detectar status 'finished', o manualmente
 * desde el panel admin tras corregir un resultado.
 */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { matchId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!body.matchId) {
    return NextResponse.json({ error: "matchId requerido" }, { status: 400 });
  }

  try {
    const result = await recalculateMatchScores(body.matchId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "error" },
      { status: 500 },
    );
  }
}
