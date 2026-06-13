import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DeletePoolButton } from "@/components/DeletePoolButton";
import { PoolNameForm } from "@/components/PoolNameForm";
import { RemoveMemberButton } from "@/components/RemoveMemberButton";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: pool } = await supabase.from("pools").select("name").eq("id", params.id).maybeSingle();
  return { title: pool ? `Administrar · ${pool.name}` : "Administrar polla" };
}

export default async function ManagePoolPage({
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
    .select("id, name, created_by")
    .eq("id", params.id)
    .maybeSingle();

  if (!pool) notFound();
  if (user!.id !== pool.created_by) redirect(`/pool/${pool.id}`);

  const { data: members } = await supabase
    .from("pool_members")
    .select("user_id, joined_at")
    .eq("pool_id", pool.id)
    .order("joined_at", { ascending: true });

  const memberIds = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", memberIds.length > 0 ? memberIds : ["x"]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  const { count: scoreCount } = await supabase
    .from("scores")
    .select("id", { count: "exact", head: true })
    .eq("pool_id", pool.id);
  const hasScores = (scoreCount ?? 0) > 0;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Administrar polla</h1>
        <Link href={`/pool/${pool.id}`} className="text-sm text-neutral-400 hover:text-white">
          ← Volver al ranking
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Nombre</h2>
        <PoolNameForm poolId={pool.id} initialName={pool.name} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Participantes ({members?.length ?? 0})</h2>
        <ul className="flex flex-col divide-y divide-neutral-900 rounded-xl border border-neutral-800">
          {(members ?? []).map((m) => {
            const isOwner = m.user_id === pool.created_by;
            return (
              <li
                key={m.user_id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="text-sm text-neutral-200">
                  {nameById.get(m.user_id) ?? "?"}
                  {isOwner && <span className="ml-2 text-xs text-neutral-500">(creador)</span>}
                </span>
                {!isOwner && <RemoveMemberButton poolId={pool.id} userId={m.user_id} />}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Eliminar polla</h2>
        <p className="text-sm text-neutral-400">
          Solo se puede eliminar mientras no haya puntos registrados. Se borra
          para todos los participantes; las predicciones de cada uno se conservan.
        </p>
        <div>
          <DeletePoolButton poolId={pool.id} hasScores={hasScores} />
        </div>
      </section>
    </div>
  );
}
