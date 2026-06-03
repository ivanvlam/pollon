import Link from "next/link";
import { notFound } from "next/navigation";

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

  const { data: ranking, error } = await supabase.rpc("get_pool_ranking", {
    p_pool_id: pool.id,
  });

  const isCreator = pool.created_by === user!.id;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{pool.name}</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Código de invitación:{" "}
            <code className="rounded bg-neutral-800 px-2 py-0.5">
              {pool.invite_code}
            </code>
          </p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link href={`/pool/${pool.id}/predictions`} className="underline">
            Predicciones
          </Link>
          {isCreator && (
            <Link href={`/pool/${pool.id}/admin`} className="underline">
              Admin
            </Link>
          )}
        </nav>
      </header>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Ranking</h2>
        {error ? (
          <p className="text-red-400">No se pudo cargar el ranking.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-800 text-neutral-400">
              <tr>
                <th className="py-2">#</th>
                <th className="py-2">Jugador</th>
                <th className="py-2 text-right">Pts</th>
                <th className="py-2 text-right">Exactos</th>
                <th className="py-2 text-right">Aciertos</th>
              </tr>
            </thead>
            <tbody>
              {(ranking ?? []).map((row, i) => (
                <tr
                  key={row.user_id}
                  className="border-b border-neutral-900"
                >
                  <td className="py-2">{i + 1}</td>
                  <td className="py-2">
                    {row.display_name}
                    {row.user_id === user!.id && (
                      <span className="ml-2 text-xs text-neutral-500">(tú)</span>
                    )}
                    {row.champion_correct && (
                      <span className="ml-2" title="Campeón acertado">
                        🏆
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right font-medium">{row.total}</td>
                  <td className="py-2 text-right text-neutral-400">
                    {row.exact_count}
                  </td>
                  <td className="py-2 text-right text-neutral-400">
                    {row.winner_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
