import Link from "next/link";
import { notFound } from "next/navigation";

import { CopyInviteButton } from "@/components/CopyInviteButton";
import { LeavePoolButton } from "@/components/LeavePoolButton";
import { RankingHistoryChart, type HistoryPoint } from "@/components/RankingHistoryChart";
import { buttonClasses } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/server";
import { toSpanish } from "@/lib/teamNames";

export default async function PoolRankingPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pool } = await supabase
    .from("pools")
    .select("id, name, invite_code, created_by")
    .eq("id", params.id)
    .maybeSingle();

  if (!pool) notFound();

  const [
    { data: ranking, error },
    { data: allScores },
    { data: myProfile },
  ] = await Promise.all([
    supabase.rpc("get_pool_ranking", { p_pool_id: pool.id }),
    supabase
      .from("scores")
      .select("user_id, match_id, points")
      .eq("pool_id", pool.id)
      .not("match_id", "is", null),
    supabase.from("profiles").select("display_name").eq("id", user!.id).maybeSingle(),
  ]);

  const inviterName = myProfile?.display_name ?? "Alguien";
  const isPoolCreator = user!.id === pool.created_by;

  // Compute bump chart history
  const matchIds = [...new Set((allScores ?? []).map((s) => s.match_id as string))];
  const { data: finishedMatches } = matchIds.length > 0
    ? await supabase
        .from("matches")
        .select("id, home_team, away_team, kickoff_at")
        .in("id", matchIds)
        .order("kickoff_at", { ascending: true })
    : { data: [] };

  const members = (ranking ?? []).map((r) => ({
    id: r.user_id,
    name: r.display_name as string,
  }));
  const memberIds = members.map((m) => m.id);

  const scoreMap = new Map<string, Map<string, number>>();
  for (const s of allScores ?? []) {
    const mid = s.match_id as string;
    if (!scoreMap.has(mid)) scoreMap.set(mid, new Map());
    scoreMap.get(mid)!.set(s.user_id, s.points);
  }

  const running: Record<string, number> = Object.fromEntries(
    memberIds.map((id) => [id, 0]),
  );
  const rankingHistory: HistoryPoint[] = [];

  for (const m of finishedMatches ?? []) {
    const matchScores = scoreMap.get(m.id) ?? new Map<string, number>();
    for (const uid of memberIds) {
      running[uid] = (running[uid] ?? 0) + (matchScores.get(uid) ?? 0);
    }
    const sorted = [...memberIds].sort((a, b) => {
      const diff = (running[b] ?? 0) - (running[a] ?? 0);
      if (diff !== 0) return diff;
      return (members.find((x) => x.id === a)?.name ?? "").localeCompare(
        members.find((x) => x.id === b)?.name ?? "",
      );
    });
    const rankMap: Record<string, number> = {};
    sorted.forEach((uid, i) => {
      rankMap[uid] = i + 1;
    });
    const homeLabel = toSpanish(m.home_team).slice(0, 3);
    const awayLabel = toSpanish(m.away_team).slice(0, 3);
    rankingHistory.push({ label: `${homeLabel}-${awayLabel}`, rankings: rankMap });
  }

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/dashboard"
        className="text-sm text-neutral-400 hover:text-white"
      >
        ← Volver a mis pollas
      </Link>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{pool.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-neutral-400">
            Código:{" "}
            <code className="rounded bg-neutral-800 px-2 py-0.5 text-neutral-200">
              {pool.invite_code}
            </code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopyInviteButton
            inviteCode={pool.invite_code}
            poolName={pool.name}
            inviterName={inviterName}
          />
          {isPoolCreator && (
            <Link href={`/pool/${pool.id}/manage`} className={buttonClasses("secondary", "sm")}>
              Administrar
            </Link>
          )}
        </div>
      </header>

      <nav className="flex flex-wrap gap-2">
        <Link
          href={`/pool/${pool.id}/predictions`}
          className={buttonClasses("secondary", "sm")}
        >
          Predicciones
        </Link>
        <Link
          href={`/pool/${pool.id}/grupos`}
          className={buttonClasses("secondary", "sm")}
        >
          Grupos
        </Link>
        <Link
          href={`/pool/${pool.id}/bracket`}
          className={buttonClasses("secondary", "sm")}
        >
          Bracket
        </Link>
      </nav>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Ranking</h2>
        {error ? (
          <p className="text-red-400">No se pudo cargar el ranking.</p>
        ) : (ranking ?? []).length === 0 ? (
          <p className="text-neutral-400">
            Todavía no hay puntos. ¡Empieza a predecir!
          </p>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[24rem] text-left text-sm">
              <thead className="border-b border-neutral-800 text-neutral-400">
                <tr>
                  <th scope="col" className="py-2 pr-2">#</th>
                  <th scope="col" className="py-2">Jugador</th>
                  <th scope="col" className="w-28 py-2 text-center" title="Puntos totales">Pts</th>
                  <th scope="col" className="w-28 py-2 text-center" title="Marcador exacto (5 puntos)">Exactos</th>
                  <th scope="col" className="w-28 py-2 text-center" title="Diferencia de goles correcta (3 puntos)">Dif</th>
                  <th scope="col" className="w-28 py-2 text-center" title="Solo ganador / clasificado acertado (2 puntos)">Aciertos</th>
                </tr>
              </thead>
              <tbody>
                {(ranking ?? []).map((row, i) => (
                  <tr key={row.user_id} className="border-b border-neutral-900">
                    <td className="py-2 pr-2 text-neutral-500">{i + 1}</td>
                    <td className="py-2">
                      <Link
                        href={`/pool/${pool.id}/player/${row.user_id}`}
                        className="font-medium text-neutral-100 hover:text-emerald-400 hover:underline"
                      >
                        {row.display_name}
                      </Link>
                      {row.user_id === user!.id && (
                        <span className="ml-2 text-xs text-emerald-400">
                          (tú)
                        </span>
                      )}
                      {row.champion_correct && (
                        <span className="ml-2" title="Campeón acertado">
                          🏆
                        </span>
                      )}
                    </td>
                    <td className="w-28 py-2 text-center font-semibold">
                      {row.total}
                    </td>
                    <td className="w-28 py-2 text-center text-neutral-400">
                      {row.exact_count}
                    </td>
                    <td className="w-28 py-2 text-center text-neutral-400">
                      {row.diff_count}
                    </td>
                    <td className="w-28 py-2 text-center text-neutral-400">
                      {row.winner_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="mt-8 grid grid-cols-3 divide-x divide-neutral-800 text-center text-xs text-neutral-500">
            <div className="flex flex-col gap-0.5 px-3">
              <dt className="font-medium text-neutral-300">Exactos</dt>
              <dd>Marcador exacto · 5 puntos</dd>
            </div>
            <div className="flex flex-col gap-0.5 px-3">
              <dt className="font-medium text-neutral-300">Dif</dt>
              <dd>Misma diferencia · 3 puntos</dd>
            </div>
            <div className="flex flex-col gap-0.5 px-3">
              <dt className="font-medium text-neutral-300">Aciertos</dt>
              <dd>Solo ganador · 2 puntos</dd>
            </div>
          </dl>
          </>
        )}
      </section>

      {rankingHistory.length >= 2 && members.length >= 2 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Historial</h2>
          <RankingHistoryChart history={rankingHistory} members={members} />
        </section>
      )}

      {!isPoolCreator && (
        <div className="mt-2 flex justify-center border-t border-neutral-900 pt-6">
          <LeavePoolButton poolId={pool.id} />
        </div>
      )}
    </div>
  );
}
