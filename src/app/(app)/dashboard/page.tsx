import Link from "next/link";

import { CreatePoolForm } from "@/components/CreatePoolForm";
import { JoinPoolForm } from "@/components/JoinPoolForm";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pollas de las que el usuario es miembro.
  const { data: memberships } = await supabase
    .from("pool_members")
    .select("pool:pools(id, name, invite_code, created_by)")
    .eq("user_id", user!.id);

  const pools = (memberships ?? [])
    .map((m) => m.pool)
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="mb-4 text-2xl font-bold">Mis pollas</h1>
        {pools.length === 0 ? (
          <p className="text-neutral-400">
            Aún no estás en ninguna polla. Crea una o únete con un código.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pools.map((pool) => (
              <li key={pool.id}>
                <Link
                  href={`/pool/${pool.id}`}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 px-4 py-3 transition hover:border-neutral-600"
                >
                  <span className="font-medium">{pool.name}</span>
                  {pool.created_by === user!.id && (
                    <span className="text-xs text-neutral-500">Creador</span>
                  )}
                </Link>
              </li>
            ))}
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
