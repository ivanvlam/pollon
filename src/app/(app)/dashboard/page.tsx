import Link from "next/link";

import { CreatePoolForm } from "@/components/CreatePoolForm";
import { ChampionReminder, NextMatchCard } from "@/components/HomeReminders";
import { JoinPoolForm } from "@/components/JoinPoolForm";
import { LiveMatches } from "@/components/LiveMatches";
import { TimezoneSync } from "@/components/TimezoneSync";
import { buttonClasses } from "@/components/ui/Button";
import type { Round } from "@/types";
import { createClient } from "@/lib/supabase/server";
import { syncLiveMatchesNow } from "@/lib/sync-live";

export const metadata = { title: "Mis pollas" };

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;
  const isAdmin = user!.email === process.env.ADMIN_EMAIL;

  // Timezone guardada (para detectar/guardar la del navegador).
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", uid)
    .maybeSingle();

  // Pollas + ranking en UNA sola llamada (sin N+1). Devuelve una fila por
  // (polla, miembro) ya ordenada por posición.
  const { data: rankingRows } = await supabase.rpc("get_my_pools_ranking");

  // Datos para los recordatorios del inicio (campeón/goleador + próximo partido).
  const nowIso = new Date().toISOString();
  const [
    { data: championPick },
    { data: topScorerPick },
    { data: firstMatch },
    { data: nextMatch },
    { data: initialLiveMatches },
  ] = await Promise.all([
    supabase.from("champion_predictions").select("team").eq("user_id", uid).maybeSingle(),
    supabase.from("top_scorer_predictions").select("player_name").eq("user_id", uid).maybeSingle(),
    supabase.from("matches").select("kickoff_at").order("kickoff_at", { ascending: true }).limit(1).maybeSingle(),
    supabase
      .from("matches")
      .select("id, home_team, away_team, kickoff_at")
      .eq("is_active", true)
      .gt("kickoff_at", nowIso)
      .order("kickoff_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("matches")
      .select("id, round, sdb_round, home_team, away_team, home_score, away_score, live_minute, updated_at")
      .eq("status", "live")
      .order("kickoff_at", { ascending: true }),
  ]);

  // Si hay partidos live con datos más viejos de 10 min, sincronizar ahora
  // directamente desde TheSportsDB sin esperar el cron (fallback si cron-job.org falla).
  let liveMatches = initialLiveMatches;
  const STALE_MS = 10 * 60 * 1000;
  const rawLive = liveMatches ?? [];
  if (rawLive.length > 0) {
    const latestRaw = rawLive.reduce((max, m) => {
      const t = m.updated_at ? new Date(m.updated_at).getTime() : 0;
      return t > max ? t : max;
    }, 0);
    if (latestRaw < Date.now() - STALE_MS) {
      try {
        await syncLiveMatchesNow();
        // Re-fetch tras el sync para obtener datos frescos
        const { data: fresh } = await supabase
          .from("matches")
          .select("id, round, sdb_round, home_team, away_team, home_score, away_score, live_minute, updated_at")
          .eq("status", "live")
          .order("kickoff_at", { ascending: true });
        liveMatches = fresh;
      } catch {
        // Si falla el sync, renderizar con los datos que tenemos
      }
    }
  }

  // Latencia: hace cuánto el cron escribió por última vez (partido live más
  // recientemente actualizado). El auto-refresco no gasta cuota de la API.
  const live = liveMatches ?? [];
  const latestUpdate = live.reduce<number>((max, m) => {
    const t = m.updated_at ? new Date(m.updated_at).getTime() : 0;
    return t > max ? t : max;
  }, 0);
  const agoMin = latestUpdate ? Math.floor((Date.now() - latestUpdate) / 60_000) : null;
  const updatedAgoLabel =
    agoMin === null ? null : agoMin <= 0 ? "actualizado recién" : `actualizado hace ${agoMin} min`;

  // Tu predicción para los partidos en vivo (para mostrarla en la tarjeta).
  const liveIds = live.map((m) => m.id);
  const { data: livePreds } = liveIds.length
    ? await supabase
        .from("predictions")
        .select("match_id, predicted_home, predicted_away, predicted_winner")
        .eq("user_id", uid)
        .in("match_id", liveIds)
    : { data: [] };
  const predByLiveMatch = new Map(
    (livePreds ?? []).map((p) => [p.match_id, p]),
  );
  const liveRows = live.map((m) => ({
    id: m.id,
    round: m.round as Round,
    home_team: m.home_team,
    away_team: m.away_team,
    home_score: m.home_score,
    away_score: m.away_score,
    live_minute: m.live_minute,
    pred: predByLiveMatch.get(m.id) ?? null,
  }));

  const { data: nextPred } = nextMatch
    ? await supabase
        .from("predictions")
        .select("predicted_home, predicted_away, predicted_winner")
        .eq("user_id", uid)
        .eq("match_id", nextMatch.id)
        .maybeSingle()
    : { data: null };

  // Agrupar por polla, preservando el orden por posición de la RPC.
  const byPool = new Map<
    string,
    { name: string; created_by: string; rows: NonNullable<typeof rankingRows> }
  >();
  for (const r of rankingRows ?? []) {
    const entry =
      byPool.get(r.pool_id) ??
      { name: r.pool_name, created_by: r.pool_created_by, rows: [] };
    entry.rows.push(r);
    byPool.set(r.pool_id, entry);
  }

  const pools = [...byPool.entries()]
    .map(([id, e]) => ({ id, name: e.name, created_by: e.created_by, rows: e.rows }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-10">
      <TimezoneSync current={profile?.timezone ?? null} />

      <section className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mis pollas</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/como-funciona" className={buttonClasses("ghost", "sm")}>
            ¿Cómo funciona?
          </Link>
          <Link href="/champion" className={buttonClasses("secondary", "sm")}>
            🏆 Mi campeón
          </Link>
          {isAdmin && (
            <Link href="/admin" className={buttonClasses("secondary", "sm")}>
              ⚙️ Admin
            </Link>
          )}
        </div>
      </section>

      <LiveMatches matches={liveRows} updatedAgoLabel={updatedAgoLabel} poolId={pools[0]?.id ?? null} />

      {pools.length > 0 && (
        <ChampionReminder
          firstKickoffAt={firstMatch?.kickoff_at ?? null}
          hasChampion={Boolean(championPick?.team)}
          hasTopScorer={Boolean(topScorerPick?.player_name)}
        />
      )}

      <section>
        <h2 className="sr-only">Listado de pollas</h2>
        {pools.length === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-8 text-center">
            <p className="text-2xl font-bold text-neutral-100">
              Crea o únete a una polla para empezar a predecir
            </p>
            <p className="mt-2 text-base text-neutral-400">
              Tus predicciones cuentan en todas las pollas en las que participes.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {pools.map((pool) => {
              const rows = pool.rows;
              const count = rows.length;
              const myIndex = rows.findIndex((r) => r.user_id === uid);
              const myRow = myIndex >= 0 ? rows[myIndex] : null;
              const namesPreview = rows
                .map((r) => r.display_name)
                .slice(0, 4)
                .join(", ");

              return (
                <li key={pool.id}>
                  <Link
                    href={`/pool/${pool.id}`}
                    className="block rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 transition hover:border-neutral-600"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{pool.name}</span>
                      {pool.created_by === uid && (
                        <span className="text-xs text-neutral-500">Creador</span>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-neutral-400">
                        {count} {count === 1 ? "participante" : "participantes"}
                      </span>
                      {myRow && (
                        <span className="text-emerald-400">
                          {rows.some((r) => r.user_id !== uid && r.rank === myRow.rank) ? `=${myRow.rank}` : `${myRow.rank}`}° · {myRow.total} puntos
                        </span>
                      )}
                    </div>

                    {namesPreview && (
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        {namesPreview}
                        {count > 4 ? ` +${count - 4}` : ""}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-8 sm:grid-cols-2">
        <section className="rounded-xl border border-neutral-800 p-6">
          <h2 className="mb-4 text-lg font-semibold">Crear una polla</h2>
          <CreatePoolForm />
        </section>
        <section className="rounded-xl border border-neutral-800 p-6">
          <h2 className="mb-4 text-lg font-semibold">Unirme a una polla</h2>
          <JoinPoolForm />
        </section>
      </div>

      {pools.length > 0 && nextMatch && (
        <NextMatchCard
          nextMatch={{
            id: nextMatch.id,
            homeTeam: nextMatch.home_team,
            awayTeam: nextMatch.away_team,
            kickoffAt: nextMatch.kickoff_at,
          }}
          nextPrediction={
            nextPred
              ? {
                  home: nextPred.predicted_home,
                  away: nextPred.predicted_away,
                  winner: nextPred.predicted_winner,
                }
              : null
          }
          predictPoolId={pools[0]?.id ?? null}
        />
      )}
    </div>
  );
}
