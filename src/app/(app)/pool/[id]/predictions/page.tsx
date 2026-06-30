import Link from "next/link";

import { MatchLiveRefresh } from "@/components/MatchLiveRefresh";
import { PredictionsClient } from "@/components/PredictionsClient";
import { createClient } from "@/lib/supabase/server";
import type { Round } from "@/types";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: pool } = await supabase.from("pools").select("name").eq("id", params.id).maybeSingle();
  return { title: pool ? `Predicciones · ${pool.name}` : "Predicciones" };
}

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
      "id, round, group_name, home_team, away_team, kickoff_at, status, home_score, away_score, home_score_90, away_score_90, home_pen, away_pen, winner, is_active, live_minute",
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

  // PostgREST corta los resultados en 1000 filas por defecto. Con muchas
  // predicciones (todos los pool-mates en partidos ya revelados son visibles
  // por RLS) el resultado supera 1000 y se truncaba en orden físico, dejando
  // fuera las filas creadas más recientemente —típicamente las predicciones
  // nuevas del propio usuario, que así aparecían como "sin predicción".
  // Paginamos con un orden total estable (match_id, user_id es UNIQUE) para
  // traerlas todas.
  type PredRow = {
    user_id: string;
    match_id: string;
    predicted_home: number | null;
    predicted_away: number | null;
    predicted_winner: string | null;
  };
  const allPreds: PredRow[] = [];
  if (matchIds.length > 0) {
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("predictions")
        .select("user_id, match_id, predicted_home, predicted_away, predicted_winner")
        .in("match_id", matchIds)
        .order("match_id", { ascending: true })
        .order("user_id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      allPreds.push(...data);
      if (data.length < PAGE) break;
    }
  }

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
      <MatchLiveRefresh matches={matches ?? []} />
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
