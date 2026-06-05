import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminMatchRow } from "@/components/AdminMatchRow";
import { AdminTopScorer } from "@/components/AdminTopScorer";
import { isKnockoutRound } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { MatchWinner, Round } from "@/types";

export default async function AdminPage({
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
  if (user!.email !== process.env.ADMIN_EMAIL) redirect(`/pool/${pool.id}`);

  const [{ data: matches }, { data: players }] = await Promise.all([
    supabase
      .from("matches")
      .select("id, round, home_team, away_team, kickoff_at, is_active, home_score, away_score, winner")
      .order("kickoff_at", { ascending: true }),
    supabase.from("players").select("name, team").order("name"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin · {pool.name}</h1>
        <Link href={`/pool/${pool.id}`} className="text-sm text-neutral-400 hover:text-white">
          ← Volver al ranking
        </Link>
      </header>

      <AdminTopScorer poolId={pool.id} players={players ?? []} />

      <p className="text-sm text-neutral-400">
        Activa los partidos para habilitar las predicciones e ingresa
        resultados manualmente si la API no los provee.
      </p>

      <div className="flex flex-col gap-3">
        {(matches ?? []).map((match) => (
          <AdminMatchRow
            key={match.id}
            poolId={pool.id}
            matchId={match.id}
            homeTeam={match.home_team}
            awayTeam={match.away_team}
            isKnockout={isKnockoutRound(match.round as Round)}
            isActive={match.is_active}
            homeScore={match.home_score}
            awayScore={match.away_score}
            winner={match.winner as MatchWinner | null}
          />
        ))}
        {(!matches || matches.length === 0) && (
          <p className="text-neutral-400">
            No hay partidos cargados. Corre el sync de API-Football.
          </p>
        )}
      </div>
    </div>
  );
}
