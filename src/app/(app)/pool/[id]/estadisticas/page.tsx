import Link from "next/link";
import { notFound } from "next/navigation";

import { computePoolStats, type Leader, type StatsMember } from "@/lib/pool-stats";
import { createClient } from "@/lib/supabase/server";

// PostgREST corta en 1000 filas por defecto. Trae todas las páginas de una
// query usando un rango incremental; el callback debe aplicar un orden total
// estable para que la paginación sea consistente.
const PAGE_SIZE = 1000;
async function fetchAllPages<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: pool } = await supabase.from("pools").select("name").eq("id", params.id).maybeSingle();
  return { title: pool ? `Estadísticas · ${pool.name}` : "Estadísticas" };
}

// ── Tarjeta de récord (líder de la polla en una métrica) ─────────────────────
function RecordCard({
  emoji,
  label,
  leader,
  valueText,
  hint,
}: {
  emoji: string;
  label: string;
  leader: Leader<number> | null;
  valueText: string | null;
  hint: string;
}) {
  const names = leader ? leader.members.map((m) => m.displayName).join(", ") : null;
  return (
    <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br from-emerald-500/10 to-transparent blur-xl" />
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
        <span className="text-base">{emoji}</span>
        {label}
      </div>
      {leader && valueText ? (
        <>
          <p className="mt-3 text-3xl font-bold tabular-nums text-emerald-400">{valueText}</p>
          <p className="mt-1 truncate text-sm font-medium text-neutral-100">{names}</p>
        </>
      ) : (
        <>
          <p className="mt-3 text-3xl font-bold text-neutral-700">—</p>
          <p className="mt-1 text-sm text-neutral-500">Sin datos aún</p>
        </>
      )}
      <p className="mt-2 text-xs text-neutral-500">{hint}</p>
    </div>
  );
}

export default async function PoolStatsPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pool } = await supabase
    .from("pools")
    .select("id, name")
    .eq("id", params.id)
    .maybeSingle();
  if (!pool) notFound();

  const [{ data: ranking }, { data: finishedMatches }] = await Promise.all([
    supabase.rpc("get_pool_ranking", { p_pool_id: pool.id }),
    supabase
      .from("matches")
      .select("id, kickoff_at")
      .eq("status", "finished")
      .order("kickoff_at", { ascending: true }),
  ]);

  const rankingRows = ranking ?? [];
  const memberIds = rankingRows.map((r) => r.user_id as string);
  const finishedIds = (finishedMatches ?? []).map((m) => m.id);
  // Kickoff por partido: la racha lo usa para agrupar partidos simultáneos.
  const finishedKickoffs = Object.fromEntries(
    (finishedMatches ?? []).map((m) => [m.id, m.kickoff_at as string]),
  );

  // Scores de partido de la polla y predicciones de los miembros en partidos
  // terminados (RLS: ya están cerrados, así que se ven todas).
  //
  // PostgREST corta en 1000 filas por defecto: con muchos miembros y partidos
  // terminados, `scores` (miembros × partidos) y `predictions` superan ese tope
  // y se truncarían en orden físico, dejando fuera filas recientes y rompiendo
  // la racha/estadísticas. Paginamos con un orden total estable.
  const [scoreRows, predRows] = await Promise.all([
    finishedIds.length > 0
      ? fetchAllPages<{ user_id: string; match_id: string | null; points: number }>((from, to) =>
          supabase
            .from("scores")
            .select("user_id, match_id, points")
            .eq("pool_id", pool.id)
            .not("match_id", "is", null)
            .order("match_id", { ascending: true })
            .order("user_id", { ascending: true })
            .range(from, to),
        )
      : Promise.resolve([] as { user_id: string; match_id: string | null; points: number }[]),
    finishedIds.length > 0 && memberIds.length > 0
      ? fetchAllPages<{ user_id: string; match_id: string }>((from, to) =>
          supabase
            .from("predictions")
            .select("user_id, match_id")
            .in("match_id", finishedIds)
            .in("user_id", memberIds)
            .order("match_id", { ascending: true })
            .order("user_id", { ascending: true })
            .range(from, to),
        )
      : Promise.resolve([] as { user_id: string; match_id: string }[]),
  ]);

  const members: StatsMember[] = rankingRows.map((r) => ({
    userId: r.user_id as string,
    displayName: r.display_name as string,
    total: Number(r.total),
    exactCount: Number(r.exact_count),
    diffCount: Number(r.diff_count),
    winnerCount: Number(r.winner_count),
    championCorrect: Boolean(r.champion_correct),
  }));

  const stats = computePoolStats({
    members,
    finishedMatchIds: finishedIds,
    finishedKickoffs,
    scores: (scoreRows ?? [])
      .filter((s) => s.match_id !== null)
      .map((s) => ({ userId: s.user_id, matchId: s.match_id as string, points: s.points })),
    predictions: (predRows ?? []).map((p) => ({ userId: p.user_id, matchId: p.match_id })),
  });

  const hasData = stats.totalFinished > 0;
  const fmtAvg = (n: number) => n.toFixed(1);
  const fmtPct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Estadísticas de la polla</h1>
        <Link href={`/pool/${pool.id}`} className="shrink-0 text-sm text-neutral-400 hover:text-white">
          ← Volver al ranking
        </Link>
      </header>

      {!hasData ? (
        <p className="text-neutral-400">
          Las estadísticas aparecen cuando hay partidos terminados.
        </p>
      ) : (
        <>
          {/* Récords */}
          <section className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <RecordCard
                emoji="🔥"
                label="Racha más larga"
                leader={stats.longestStreak}
                valueText={stats.longestStreak ? `${stats.longestStreak.value}` : null}
                hint="Partidos seguidos sumando puntos"
              />
              <RecordCard
                emoji="📈"
                label="Mejor promedio"
                leader={stats.bestAvg}
                valueText={stats.bestAvg ? `${fmtAvg(stats.bestAvg.value)} pts` : null}
                hint="Puntos por partido predicho"
              />
              <RecordCard
                emoji="🎯"
                label="Más certero"
                leader={stats.bestAccuracy}
                valueText={stats.bestAccuracy ? fmtPct(stats.bestAccuracy.value) : null}
                hint="Aciertos sobre partidos predichos"
              />
            </div>
          </section>

          {/* Tabla por jugador */}
          <section className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Por jugador</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead className="border-b border-neutral-800 text-xs text-neutral-400 sm:text-sm">
                  <tr>
                    <th scope="col" className="py-2 pl-2 pr-3">Jugador</th>
                    <th scope="col" className="w-28 py-2 text-center" title="Partidos terminados que predijo">
                      <span className="sm:hidden">Predic.</span>
                      <span className="hidden sm:inline">Predicciones</span>
                    </th>
                    <th scope="col" className="w-24 py-2 text-center" title="Aciertos sobre partidos predichos">
                      <span className="sm:hidden">% Ac.</span>
                      <span className="hidden sm:inline">% Acierto</span>
                    </th>
                    <th scope="col" className="w-24 py-2 text-center" title="Puntos por partido predicho">Prom.</th>
                    <th scope="col" className="w-24 py-2 text-center" title="Racha más larga (partidos seguidos sumando)">
                      <span className="sm:hidden">R. máx</span>
                      <span className="hidden sm:inline">Racha máx</span>
                    </th>
                    <th scope="col" className="w-24 py-2 text-center" title="Racha activa ahora mismo">
                      <span className="sm:hidden">R. act.</span>
                      <span className="hidden sm:inline">Racha actual</span>
                    </th>
                    <th scope="col" className="w-24 py-2 text-center" title="Marcadores exactos (5 pts)">
                      <span className="sm:hidden">Exact.</span>
                      <span className="hidden sm:inline">Exactos</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.members.map((m) => {
                    const isMe = m.userId === user!.id;
                    return (
                      <tr key={m.userId} className="border-b border-neutral-900">
                        <td className={`max-w-0 py-2 pl-2 pr-3${isMe ? " border-l-2 border-emerald-500" : ""}`}>
                          <Link
                            href={`/pool/${pool.id}/player/${m.userId}`}
                            className="block truncate font-medium text-neutral-100 hover:text-emerald-400 hover:underline"
                          >
                            {m.displayName}
                            {isMe && <span className="ml-2 text-xs text-emerald-400">(tú)</span>}
                            {m.championCorrect && <span className="ml-1" title="Campeón acertado">🏆</span>}
                          </Link>
                        </td>
                        <td className="w-28 py-2 text-center tabular-nums text-neutral-400">{m.predictedFinished}</td>
                        <td className="w-24 py-2 text-center tabular-nums text-neutral-300">
                          {m.predictedFinished > 0 ? fmtPct(m.accuracy) : "—"}
                        </td>
                        <td className="w-24 py-2 text-center tabular-nums text-neutral-300">
                          {m.predictedFinished > 0 ? fmtAvg(m.avgPerPredicted) : "—"}
                        </td>
                        <td className="w-24 py-2 text-center tabular-nums text-neutral-300">{m.longestStreak}</td>
                        <td className="w-24 py-2 text-center tabular-nums">
                          {m.currentStreak > 0 ? (
                            <span className="font-medium text-emerald-400" title="Racha activa">🔥 {m.currentStreak}</span>
                          ) : (
                            <span className="text-neutral-600">0</span>
                          )}
                        </td>
                        <td className="w-24 py-2 text-center tabular-nums text-neutral-400">{m.exactCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-center text-xs text-neutral-500">
              El promedio y el % de acierto consideran solo partidos (no incluyen campeón ni goleador).
            </p>
          </section>
        </>
      )}
    </div>
  );
}
