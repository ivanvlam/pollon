import Link from "next/link";
import { notFound } from "next/navigation";

import { computePoolStats, type Leader, type StatsMember } from "@/lib/pool-stats";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: pool } = await supabase.from("pools").select("name").eq("id", params.id).maybeSingle();
  return { title: pool ? `Estadísticas · ${pool.name}` : "Estadísticas" };
}

// ── Tarjeta de récord (líder de la polla en una métrica) ─────────────────────
const ACCENTS = {
  amber: { bar: "bg-amber-500", text: "text-amber-400", glow: "from-amber-500/10" },
  emerald: { bar: "bg-emerald-500", text: "text-emerald-400", glow: "from-emerald-500/10" },
  sky: { bar: "bg-sky-500", text: "text-sky-400", glow: "from-sky-500/10" },
} as const;

function RecordCard({
  emoji,
  label,
  accent,
  leader,
  valueText,
  hint,
}: {
  emoji: string;
  label: string;
  accent: keyof typeof ACCENTS;
  leader: Leader<number> | null;
  valueText: string | null;
  hint: string;
}) {
  const a = ACCENTS[accent];
  const names = leader ? leader.members.map((m) => m.displayName).join(", ") : null;
  return (
    <div className="relative overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
      <div className={`absolute inset-x-0 top-0 h-1 ${a.bar}`} />
      <div className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${a.glow} to-transparent blur-xl`} />
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-400">
        <span className="text-base">{emoji}</span>
        {label}
      </div>
      {leader && valueText ? (
        <>
          <p className={`mt-3 text-3xl font-bold tabular-nums ${a.text}`}>{valueText}</p>
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

  // Scores de partido de la polla y predicciones de los miembros en partidos
  // terminados (RLS: ya están cerrados, así que se ven todas).
  const [{ data: scoreRows }, { data: predRows }] = await Promise.all([
    finishedIds.length > 0
      ? supabase
          .from("scores")
          .select("user_id, match_id, points")
          .eq("pool_id", pool.id)
          .not("match_id", "is", null)
      : Promise.resolve({ data: [] as { user_id: string; match_id: string | null; points: number }[] }),
    finishedIds.length > 0 && memberIds.length > 0
      ? supabase
          .from("predictions")
          .select("user_id, match_id")
          .in("match_id", finishedIds)
          .in("user_id", memberIds)
      : Promise.resolve({ data: [] as { user_id: string; match_id: string }[] }),
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
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Estadísticas</h1>
        <Link href={`/pool/${pool.id}`} className="text-sm text-neutral-400 hover:text-white">
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
            <h2 className="text-lg font-semibold">Récords de la polla</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <RecordCard
                emoji="🔥"
                label="Racha más larga"
                accent="amber"
                leader={stats.longestStreak}
                valueText={stats.longestStreak ? `${stats.longestStreak.value}` : null}
                hint="Partidos seguidos sumando puntos"
              />
              <RecordCard
                emoji="📈"
                label="Mejor promedio"
                accent="emerald"
                leader={stats.bestAvg}
                valueText={stats.bestAvg ? `${fmtAvg(stats.bestAvg.value)} pts` : null}
                hint="Puntos por partido predicho"
              />
              <RecordCard
                emoji="🎯"
                label="Más certero"
                accent="sky"
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
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead className="border-b border-neutral-800 text-xs text-neutral-400 sm:text-sm">
                  <tr>
                    <th scope="col" className="py-2 pl-2 pr-3">Jugador</th>
                    <th scope="col" className="w-14 py-2 text-center" title="Partidos terminados que predijo">PJ</th>
                    <th scope="col" className="w-16 py-2 text-center" title="Aciertos sobre partidos predichos">
                      <span className="sm:hidden">% Ac.</span>
                      <span className="hidden sm:inline">% Acierto</span>
                    </th>
                    <th scope="col" className="w-16 py-2 text-center" title="Puntos por partido predicho">Prom.</th>
                    <th scope="col" className="w-16 py-2 text-center" title="Racha más larga · activa">Racha</th>
                    <th scope="col" className="w-16 py-2 text-center" title="Marcadores exactos (5 pts)">
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
                        <td className="w-14 py-2 text-center tabular-nums text-neutral-400">{m.predictedFinished}</td>
                        <td className="w-16 py-2 text-center tabular-nums text-neutral-300">
                          {m.predictedFinished > 0 ? fmtPct(m.accuracy) : "—"}
                        </td>
                        <td className="w-16 py-2 text-center tabular-nums text-neutral-300">
                          {m.predictedFinished > 0 ? fmtAvg(m.avgPerPredicted) : "—"}
                        </td>
                        <td className="w-16 py-2 text-center tabular-nums text-neutral-300">
                          {m.longestStreak}
                          {m.currentStreak > 0 && (
                            <span className="ml-1 text-xs text-amber-400" title="Racha activa">🔥{m.currentStreak}</span>
                          )}
                        </td>
                        <td className="w-16 py-2 text-center tabular-nums text-neutral-400">{m.exactCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-neutral-500">
              El promedio y el % de acierto consideran solo partidos (no incluyen campeón ni goleador).
            </p>
          </section>
        </>
      )}
    </div>
  );
}
