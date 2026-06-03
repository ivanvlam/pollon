import { NextResponse, type NextRequest } from "next/server";

import { LOCK_HOURS_BEFORE_KICKOFF } from "@/lib/constants";
import { verifyCronSecret } from "@/lib/cron";
import { sendReminderEmail } from "@/lib/email";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Ventana de aviso: partidos que cierran en las próximas 2 horas. */
const REMINDER_WINDOW_HOURS = 2;

/**
 * Busca partidos cuyo cierre (kickoff - 24h) cae en las próximas 2h,
 * encuentra usuarios sin predicción para esos partidos y les envía un
 * recordatorio. Corre cada hora.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const appUrl = process.env.APP_URL ?? "";
  const now = Date.now();

  // El cierre ocurre a kickoff - 24h. Queremos partidos cuyo cierre cae
  // entre ahora y ahora + 2h, es decir kickoff en [now+24h, now+26h].
  const lockMs = LOCK_HOURS_BEFORE_KICKOFF * 3600_000;
  const fromIso = new Date(now + lockMs).toISOString();
  const toIso = new Date(now + lockMs + REMINDER_WINDOW_HOURS * 3600_000).toISOString();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, home_team, away_team, kickoff_at")
    .eq("is_active", true)
    .gte("kickoff_at", fromIso)
    .lte("kickoff_at", toIso);

  if (!matches || matches.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Usuarios que pertenecen al menos a una polla.
  const { data: members } = await supabase
    .from("pool_members")
    .select("user_id");
  const userIds = [...new Set((members ?? []).map((m) => m.user_id))];

  if (userIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // Mapa id → email vía Auth admin.
  const { data: usersList } = await supabase.auth.admin.listUsers();
  const emailById = new Map(
    (usersList?.users ?? []).map((u) => [u.id, u.email ?? null]),
  );

  const matchIds = matches.map((m) => m.id);

  // Predicciones existentes para esos partidos.
  const { data: preds } = await supabase
    .from("predictions")
    .select("user_id, match_id")
    .in("match_id", matchIds);

  const predicted = new Set(
    (preds ?? []).map((p) => `${p.user_id}:${p.match_id}`),
  );

  let sent = 0;
  for (const match of matches) {
    for (const userId of userIds) {
      if (predicted.has(`${userId}:${match.id}`)) continue;
      const email = emailById.get(userId);
      if (!email) continue;
      try {
        await sendReminderEmail({
          to: email,
          homeTeam: match.home_team,
          awayTeam: match.away_team,
          kickoffAt: match.kickoff_at,
          matchUrl: `${appUrl}/dashboard`,
        });
        sent += 1;
      } catch {
        // Un email fallido no debe abortar el resto.
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
