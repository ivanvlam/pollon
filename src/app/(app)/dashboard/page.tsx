import Link from "next/link";

import type { GroupMatchRow } from "@/components/GroupCard";
import { ChampionReminder, NextMatchCard } from "@/components/HomeReminders";
import { LiveMatches, type LiveGroupData } from "@/components/LiveMatches";
import { MusicTicker } from "@/components/MusicTicker";
import { TimezoneSync } from "@/components/TimezoneSync";
import { buttonClasses } from "@/components/ui/Button";
import type { Round } from "@/types";
import { createClient } from "@/lib/supabase/server";
import { getWrappedGate } from "@/lib/tournament";
import { syncLiveMatchesNow } from "@/lib/sync-live";
import {
  computeGroupClinch,
  computeGroupStandings,
  projectLivePositions,
  type GroupMatch,
  type StandingRow,
} from "@/lib/standings";

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
  const livePoolId = pools[0]?.id ?? null;

  // Banner del Wrapped: aparece al terminar el torneo (campeón + goleador
  // definidos) y lleva a la primera polla alfabética, igual que "Predecir".
  const { ready: wrappedReady } = await getWrappedGate(supabase);
  const wrappedPoolId = pools[0]?.id ?? null;

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
      .select("id, round, sdb_round, group_name, home_team, away_team, home_score, away_score, home_score_90, away_score_90, live_minute, kickoff_at, updated_at")
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
          .select("id, round, sdb_round, group_name, home_team, away_team, home_score, away_score, home_score_90, away_score_90, live_minute, kickoff_at, updated_at")
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
  const latestUpdateAt = latestUpdate ? new Date(latestUpdate).toISOString() : null;

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

  // Datos de grupo para los partidos de grupo en vivo: proyección de posición
  // (si el marcador en vivo se mantiene) y la tabla completa del grupo, para
  // poder abrir su modal desde la tarjeta en vivo.
  const liveGroupNames = [
    ...new Set(
      live
        .filter((m) => m.round === "group_stage" && m.group_name)
        .map((m) => m.group_name as string),
    ),
  ];

  const projByGroup = new Map<string, ReturnType<typeof projectLivePositions>>();
  let liveGroupData: Map<string, LiveGroupData> | undefined;
  let qualifyingThirds: Set<string> | undefined;

  if (liveGroupNames.length) {
    // Todos los partidos de fase de grupos: para standings, mejores terceros
    // (cross-grupo) y el contenido del modal.
    const { data: allGroupMatches } = await supabase
      .from("matches")
      .select(
        "id, group_name, home_team, away_team, kickoff_at, status, home_score, away_score, is_active, live_minute",
      )
      .eq("round", "group_stage")
      .order("kickoff_at", { ascending: true });
    const allG = allGroupMatches ?? [];

    const byGroup = new Map<string, typeof allG>();
    for (const m of allG) {
      if (!m.group_name) continue;
      const arr = byGroup.get(m.group_name) ?? [];
      arr.push(m);
      byGroup.set(m.group_name, arr);
    }

    const standingsByGroup = new Map<string, StandingRow[]>();
    for (const [g, ms] of byGroup) {
      standingsByGroup.set(g, computeGroupStandings(ms as GroupMatch[]));
      projByGroup.set(g, projectLivePositions(ms as GroupMatch[]));
    }

    // 8 mejores terceros entre todos los grupos.
    const thirds = [...byGroup.keys()].flatMap((g) => {
      const s = standingsByGroup.get(g)!;
      return s[2] ? [s[2]] : [];
    });
    thirds.sort((a, b) => b.points - a.points || b.gd - a.gd || a.team.localeCompare(b.team));
    qualifyingThirds = new Set(thirds.slice(0, 8).map((r) => r.team));

    // Predicciones y puntos del usuario, solo para los partidos de los grupos
    // que tienen un partido en vivo (los que abren modal).
    const liveGroupMatchIds = allG
      .filter((m) => m.group_name && liveGroupNames.includes(m.group_name))
      .map((m) => m.id);
    const { data: gPreds } = liveGroupMatchIds.length
      ? await supabase
          .from("predictions")
          .select("match_id, predicted_home, predicted_away")
          .eq("user_id", uid)
          .in("match_id", liveGroupMatchIds)
      : { data: [] };
    const { data: gScores } = livePoolId && liveGroupMatchIds.length
      ? await supabase
          .from("scores")
          .select("match_id, points")
          .eq("pool_id", livePoolId)
          .eq("user_id", uid)
          .in("match_id", liveGroupMatchIds)
      : { data: [] };
    const predByGroupMatch = new Map((gPreds ?? []).map((p) => [p.match_id, p]));
    const pointsByGroupMatch = new Map((gScores ?? []).map((s) => [s.match_id, s.points]));

    liveGroupData = new Map();
    for (const g of liveGroupNames) {
      const ms = byGroup.get(g) ?? [];
      const rows: GroupMatchRow[] = ms.map((m) => ({
        id: m.id,
        home_team: m.home_team,
        away_team: m.away_team,
        kickoff_at: m.kickoff_at,
        status: m.status,
        home_score: m.home_score,
        away_score: m.away_score,
        live_minute: m.live_minute,
        is_active: m.is_active,
        pred: predByGroupMatch.get(m.id) ?? null,
        myPoints: pointsByGroupMatch.get(m.id),
      }));
      liveGroupData.set(g, {
        name: g.replace(/^Group\s+/i, "Grupo "),
        standings: standingsByGroup.get(g) ?? [],
        matches: rows,
        clinch: computeGroupClinch(ms as GroupMatch[]),
      });
    }
  }

  const liveRows = live.map((m) => {
    const proj =
      m.round === "group_stage" && m.group_name
        ? projByGroup.get(m.group_name)
        : null;
    return {
      id: m.id,
      round: m.round as Round,
      group_name: m.group_name ?? null,
      home_team: m.home_team,
      away_team: m.away_team,
      home_score: m.home_score,
      away_score: m.away_score,
      home_score_90: m.home_score_90,
      away_score_90: m.away_score_90,
      live_minute: m.live_minute,
      kickoff_at: m.kickoff_at,
      pred: predByLiveMatch.get(m.id) ?? null,
      homeProj: proj?.get(m.home_team) ?? null,
      awayProj: proj?.get(m.away_team) ?? null,
    };
  });

  const { data: nextPred } = nextMatch
    ? await supabase
        .from("predictions")
        .select("predicted_home, predicted_away, predicted_winner")
        .eq("user_id", uid)
        .eq("match_id", nextMatch.id)
        .maybeSingle()
    : { data: null };

  return (
    <div className="flex flex-col gap-10">
      <TimezoneSync current={profile?.timezone ?? null} />

      <section className="flex flex-col gap-3">
        {/* Fila 1: título + acción principal (misma altura) */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Mis pollas</h1>
          <Link href="/pools/nueva" className={buttonClasses("primary", "sm", "shrink-0")}>
            ＋ Nueva polla
          </Link>
        </div>
        {/* Fila 2: accesos secundarios */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Link href="/como-funciona" className={buttonClasses("secondary", "sm", "w-full sm:w-auto")}>
            ¿Cómo funciona?
          </Link>
          <Link href="/champion" className={buttonClasses("secondary", "sm", "w-full sm:w-auto")}>
            🏆 Mi campeón
          </Link>
          {isAdmin && (
            <Link href="/admin" className={buttonClasses("secondary", "sm", "w-full sm:w-auto")}>
              ⚙️ Admin
            </Link>
          )}
        </div>
      </section>

      {wrappedReady && wrappedPoolId && (
        <Link
          href={`/pool/${wrappedPoolId}/wrapped`}
          className="group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-600/25 via-violet-600/20 to-fuchsia-600/25 px-5 py-4 transition hover:border-emerald-400/70"
        >
          <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-emerald-400/20 blur-2xl" />
          <span className="flex flex-col">
            <span className="flex items-center gap-2 text-base font-bold text-white">
              🐔 Tu Pollon Wrapped 2026
            </span>
            <span className="text-sm text-neutral-300">
              Tu resumen del Mundial: puntos, mejor pálpito y tu personaje.
            </span>
          </span>
          <span className="shrink-0 text-emerald-300 transition-transform group-hover:translate-x-0.5">
            Ver →
          </span>
        </Link>
      )}

      <LiveMatches
        matches={liveRows}
        latestUpdateAt={latestUpdateAt}
        poolId={livePoolId}
        groups={liveGroupData}
        qualifyingThirds={qualifyingThirds}
      />

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
            <Link
              href="/pools/nueva"
              className={`${buttonClasses("primary", "md")} mt-5 inline-flex`}
            >
              ＋ Nueva polla
            </Link>
          </div>
        ) : (
          <ul className="stagger grid gap-3 sm:grid-cols-2">
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{pool.name}</span>
                      {pool.created_by === uid && (
                        <span className="shrink-0 text-xs text-neutral-500">Creador</span>
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

      <MusicTicker />
    </div>
  );
}
