import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminChampion } from "@/components/AdminChampion";
import { AdminMatchRow } from "@/components/AdminMatchRow";
import { AdminRoundActivator } from "@/components/AdminRoundActivator";
import { AdminTopScorer } from "@/components/AdminTopScorer";
import { isKnockoutRound, ROUNDS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { toSpanish } from "@/lib/teamNames";
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

      <AdminChampion
        poolId={pool.id}
        teams={[...new Set((matches ?? []).flatMap((m) => [m.home_team, m.away_team]))].sort().map(toSpanish)}
      />

      <p className="text-sm text-neutral-400">
        Activa los partidos para habilitar las predicciones e ingresa
        resultados manualmente si la API no los provee.
      </p>

      {(!matches || matches.length === 0) ? (
        <p className="text-neutral-400">
          No hay partidos cargados. Usa el botón &quot;Sincronizar partidos&quot; de arriba.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {ROUNDS.filter((r) => r !== "group_stage").map((round) => {
            const roundMatches = (matches ?? []).filter((m) => m.round === round);
            if (roundMatches.length === 0) return null;
            const allActive = roundMatches.every((m) => m.is_active);
            const ROUND_LABELS: Record<string, string> = {
              round_of_32: "Ronda de 32",
              round_of_16: "Octavos de final",
              quarterfinal: "Cuartos de final",
              semifinal: "Semifinales",
              final: "Final",
            };
            return (
              <div key={round} className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-neutral-300">{ROUND_LABELS[round] ?? round}</h2>
                  {!allActive && (
                    <AdminRoundActivator poolId={pool.id} round={round} label={ROUND_LABELS[round] ?? round} />
                  )}
                </div>
                {roundMatches.map((match) => (
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
              </div>
            );
          })}

          <div className="flex flex-col gap-3">
            <h2 className="font-semibold text-neutral-300">Fase de grupos</h2>
            {(matches ?? []).filter((m) => m.round === "group_stage").map((match) => (
              <AdminMatchRow
                key={match.id}
                poolId={pool.id}
                matchId={match.id}
                homeTeam={match.home_team}
                awayTeam={match.away_team}
                isKnockout={false}
                isActive={match.is_active}
                homeScore={match.home_score}
                awayScore={match.away_score}
                winner={match.winner as MatchWinner | null}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
