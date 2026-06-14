import Link from "next/link";
import { notFound } from "next/navigation";

import { CopyInviteButton } from "@/components/CopyInviteButton";
import { LeavePoolButton } from "@/components/LeavePoolButton";
import { buttonClasses } from "@/components/ui/Button";
import { calculateMatchScore } from "@/lib/scoring";
import { createClient } from "@/lib/supabase/server";
import type { MatchWinner, Round } from "@/types";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: pool } = await supabase.from("pools").select("name").eq("id", params.id).maybeSingle();
  return { title: pool?.name ?? "Polla" };
}

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
    { data: myProfile },
    { data: liveMatches },
  ] = await Promise.all([
    supabase.rpc("get_pool_ranking", { p_pool_id: pool.id }),
    supabase.from("profiles").select("display_name").eq("id", user!.id).maybeSingle(),
    supabase
      .from("matches")
      .select("id, round, home_score, away_score, winner")
      .eq("status", "live"),
  ]);

  const inviterName = myProfile?.display_name ?? "Alguien";
  const isPoolCreator = user!.id === pool.created_by;

  const memberIds = (ranking ?? []).map((r) => r.user_id as string);
  const liveMatchIds = (liveMatches ?? []).map((m) => m.id);
  const isLive = liveMatchIds.length > 0;

  const { data: livePredictions } =
    isLive && memberIds.length > 0
      ? await supabase
          .from("predictions")
          .select("user_id, match_id, predicted_home, predicted_away, predicted_winner")
          .in("match_id", liveMatchIds)
          .in("user_id", memberIds)
      : { data: [] };

  const livePoints: Record<string, number> = Object.fromEntries(memberIds.map((id) => [id, 0]));

  const rows = ranking ?? [];
  const isTied = (a: typeof rows[0], b: typeof rows[0]) =>
    a.total === b.total &&
    a.exact_count === b.exact_count &&
    a.diff_count === b.diff_count &&
    a.winner_count === b.winner_count &&
    a.champion_correct === b.champion_correct;
  const rankInfo: { rank: number; tied: boolean }[] = [];
  let gi = 0;
  while (gi < rows.length) {
    let gj = gi + 1;
    while (gj < rows.length && isTied(rows[gi]!, rows[gj]!)) gj++;
    const tied = gj - gi > 1;
    for (let k = gi; k < gj; k++) rankInfo.push({ rank: gi + 1, tied });
    gi = gj;
  }

  for (const match of liveMatches ?? []) {
    for (const pred of livePredictions ?? []) {
      if (pred.match_id !== match.id) continue;
      const result = calculateMatchScore(
        {
          round: match.round as Round,
          home_score: match.home_score,
          away_score: match.away_score,
          winner: match.winner as MatchWinner | null,
        },
        {
          predicted_home: pred.predicted_home,
          predicted_away: pred.predicted_away,
          predicted_winner: pred.predicted_winner as MatchWinner | null,
        },
      );
      if (result) livePoints[pred.user_id] = (livePoints[pred.user_id] ?? 0) + result.points;
    }
  }

  return (
    <div className="flex flex-col gap-8">
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
          <Link
            href="/dashboard"
            className="text-sm text-neutral-400 hover:text-white"
          >
            ← Mis pollas
          </Link>
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
        <Link
          href={`/pool/${pool.id}/historial`}
          className={buttonClasses("secondary", "sm")}
        >
          Historial
        </Link>
      </nav>

      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          Ranking
          {isLive && (
            <span className="flex items-center gap-1.5 text-xs font-normal text-red-400">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              En vivo
            </span>
          )}
        </h2>
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
                  <th scope="col" className="w-7 py-2 pl-2 pr-3 text-center">#</th>
                  <th scope="col" className="py-2 pl-8">Jugador</th>
                  <th scope="col" className="w-28 py-2 text-center">Puntos</th>
                  <th scope="col" className="w-28 py-2 text-center">Exactos</th>
                  <th scope="col" className="w-28 py-2 text-center">Diferencia</th>
                  <th scope="col" className="w-28 py-2 text-center">Aciertos</th>
                  <th scope="col" className="w-28 py-2 text-center">Predicciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isMe = row.user_id === user!.id;
                  const { rank, tied } = rankInfo[i]!;
                  return (
                  <tr key={row.user_id} className="border-b border-neutral-900">
                    <td className={`w-7 py-2 pl-2 pr-3 text-center tabular-nums text-neutral-500${isMe ? " border-l-2 border-emerald-500" : ""}`}>
                      {tied ? (
                        <><span className="text-neutral-600">=</span>{rank}°</>
                      ) : <>{rank}°</>}
                    </td>
                    <td className="py-2 pl-8">
                      <Link
                        href={`/pool/${pool.id}/player/${row.user_id}`}
                        className="font-medium text-neutral-100 hover:text-emerald-400 hover:underline"
                      >
                        {row.display_name}
                      </Link>
                      {isMe && (
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
                      {isLive && (
                        <span
                          className={`ml-1.5 text-xs tabular-nums font-normal ${
                            (livePoints[row.user_id as string] ?? 0) > 0
                              ? "animate-pulse text-emerald-400"
                              : "text-neutral-600"
                          }`}
                        >
                          +{livePoints[row.user_id as string] ?? 0}
                        </span>
                      )}
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
                    <td className="w-28 py-2 text-center text-neutral-400">
                      {row.prediction_count ?? 0}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <dl className="mt-8 grid grid-cols-3 divide-x divide-neutral-800 text-center text-xs text-neutral-500">
            <div className="flex flex-col gap-0.5 px-3">
              <dt className="font-medium text-neutral-300">Exactos</dt>
              <dd>Marcador exacto · 5 puntos</dd>
            </div>
            <div className="flex flex-col gap-0.5 px-3">
              <dt className="font-medium text-neutral-300">Diferencia</dt>
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

      {!isPoolCreator && (
        <div className="mt-2 flex justify-center border-t border-neutral-900 pt-6">
          <LeavePoolButton poolId={pool.id} />
        </div>
      )}
    </div>
  );
}
