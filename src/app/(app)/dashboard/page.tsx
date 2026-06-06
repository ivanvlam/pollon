import Link from "next/link";

import { CreatePoolForm } from "@/components/CreatePoolForm";
import { JoinPoolForm } from "@/components/JoinPoolForm";
import { TimezoneSync } from "@/components/TimezoneSync";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Mis pollas" };

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

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

  return (
    <div className="flex flex-col gap-10">
      <TimezoneSync current={profile?.timezone ?? null} />

      <section className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mis pollas</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/como-funciona"
            className="rounded-lg px-3 py-2 text-sm text-neutral-300 transition hover:bg-neutral-800"
          >
            ¿Cómo funciona?
          </Link>
          <Link
            href="/champion"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium transition hover:bg-neutral-800"
          >
            🏆 Mi campeón
          </Link>
        </div>
      </section>

      <section>
        <h2 className="sr-only">Listado de pollas</h2>
        {pools.length === 0 ? (
          <p className="text-neutral-400">
            Aún no estás en ninguna polla. Crea una o únete con un código.
          </p>
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
                          Vas {myIndex + 1}º · {myRow.total} pts
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
    </div>
  );
}
