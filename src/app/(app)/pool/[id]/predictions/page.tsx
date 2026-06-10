import Link from "next/link";

import { PredictionsClient } from "@/components/PredictionsClient";
import { createClient } from "@/lib/supabase/server";
import type { Round } from "@/types";

export default async function PredictionsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { from?: string };
}) {
  // Si se llega desde la tarjeta "Próximo partido" del inicio, el botón
  // Volver regresa al dashboard en vez de al ranking de la polla.
  const fromHome = searchParams.from === "home";
  const backHref = fromHome ? "/dashboard" : `/pool/${params.id}`;
  const backLabel = fromHome ? "← Volver al inicio" : "← Volver al ranking";
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, round, group_name, home_team, away_team, kickoff_at, status, home_score, away_score, winner, is_active",
    )
    .eq("is_active", true)
    .order("kickoff_at", { ascending: true });

  const matchIds = (matches ?? []).map((m) => m.id);

  const { data: members } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", params.id);
  const memberIds = (members ?? []).map((m) => m.user_id);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", memberIds.length > 0 ? memberIds : ["x"]);
  const nameById = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p.display_name ?? "?"]),
  );

  const { data: allPreds } = await supabase
    .from("predictions")
    .select("user_id, match_id, predicted_home, predicted_away, predicted_winner")
    .in("match_id", matchIds.length > 0 ? matchIds : ["x"]);

  const { data: myScores } = await supabase
    .from("scores")
    .select("match_id, points")
    .eq("pool_id", params.id)
    .eq("user_id", uid);
  const pointsByMatch = Object.fromEntries(
    (myScores ?? [])
      .filter((s) => s.match_id !== null)
      .map((s) => [s.match_id as string, s.points]),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Predicciones</h1>
        <Link
          href={backHref}
          className="text-sm text-neutral-400 hover:text-white"
        >
          {backLabel}
        </Link>
      </header>

      {(!matches || matches.length === 0) ? (
        <p className="text-neutral-400">
          Aún no hay partidos habilitados para predecir.
        </p>
      ) : (
        <PredictionsClient
          poolId={params.id}
          uid={uid}
          matches={(matches ?? []).map((m) => ({ ...m, round: m.round as Round }))}
          allPreds={allPreds ?? []}
          nameById={nameById}
          pointsByMatch={pointsByMatch}
          memberIds={memberIds}
        />
      )}
    </div>
  );
}
