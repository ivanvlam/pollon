import Link from "next/link";
import { notFound } from "next/navigation";

import { CopyInviteButton } from "@/components/CopyInviteButton";
import { DeletePoolButton } from "@/components/DeletePoolButton";
import { LeavePoolButton } from "@/components/LeavePoolButton";
import { createClient } from "@/lib/supabase/server";

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

  const [{ data: ranking, error }, { count: memberCount }] = await Promise.all([
    supabase.rpc("get_pool_ranking", { p_pool_id: pool.id }),
    supabase
      .from("pool_members")
      .select("id", { count: "exact", head: true })
      .eq("pool_id", pool.id),
  ]);

  const isCreator = user!.email === process.env.ADMIN_EMAIL;
  const isPoolCreator = user!.id === pool.created_by;

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
          <CopyInviteButton inviteCode={pool.invite_code} />
          {!isPoolCreator && <LeavePoolButton poolId={pool.id} />}
          {isPoolCreator && (memberCount ?? 0) <= 1 && (
            <DeletePoolButton poolId={pool.id} />
          )}
        </div>
      </header>

      <nav className="flex gap-4 text-sm">
        <Link
          href={`/pool/${pool.id}/predictions`}
          className="text-emerald-400 hover:underline"
        >
          Predicciones
        </Link>
        <Link
          href={`/pool/${pool.id}/grupos`}
          className="text-emerald-400 hover:underline"
        >
          Grupos
        </Link>
        <Link
          href={`/pool/${pool.id}/bracket`}
          className="text-emerald-400 hover:underline"
        >
          Bracket
        </Link>
        {isCreator && (
          <Link
            href={`/pool/${pool.id}/admin`}
            className="text-emerald-400 hover:underline"
          >
            Admin
          </Link>
        )}
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
            <table className="text-left text-sm">
              <thead className="border-b border-neutral-800 text-neutral-400">
                <tr>
                  <th className="py-2 pr-1">#</th>
                  <th className="py-2 pr-6">Jugador</th>
                  <th className="w-16 py-2 text-center" title="Puntos totales">Pts</th>
                  <th className="w-16 py-2 text-center" title="Marcador exacto (5 pts)">Exactos</th>
                  <th className="w-16 py-2 text-center" title="Diferencia de goles correcta (3 pts)">Dif</th>
                  <th className="w-16 py-2 text-center" title="Solo ganador / clasificado acertado (2 pts)">Aciertos</th>
                </tr>
              </thead>
              <tbody>
                {(ranking ?? []).map((row, i) => (
                  <tr key={row.user_id} className="border-b border-neutral-900">
                    <td className="py-2 pr-1 text-neutral-500">{i + 1}</td>
                    <td className="py-2 pr-6">
                      {row.display_name}
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
                    <td className="w-16 py-2 text-center font-semibold">
                      {row.total}
                    </td>
                    <td className="w-16 py-2 text-center text-neutral-400">
                      {row.exact_count}
                    </td>
                    <td className="w-16 py-2 text-center text-neutral-400">
                      {row.diff_count}
                    </td>
                    <td className="w-16 py-2 text-center text-neutral-400">
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
              <dd>marcador exacto · 5 pts</dd>
            </div>
            <div className="flex flex-col gap-0.5 px-3">
              <dt className="font-medium text-neutral-300">Dif</dt>
              <dd>misma diferencia · 3 pts</dd>
            </div>
            <div className="flex flex-col gap-0.5 px-3">
              <dt className="font-medium text-neutral-300">Aciertos</dt>
              <dd>solo ganador · 2 pts</dd>
            </div>
          </dl>
          </>
        )}
      </section>
    </div>
  );
}
