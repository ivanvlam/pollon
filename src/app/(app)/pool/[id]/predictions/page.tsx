import Link from "next/link";

import { LockCountdown } from "@/components/LockCountdown";
import { PredictionForm } from "@/components/PredictionForm";
import { isKnockoutRound } from "@/lib/constants";
import { isPredictionLocked } from "@/lib/timing";
import { createClient } from "@/lib/supabase/server";
import type { MatchWinner, Round } from "@/types";

export default async function PredictionsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Partidos habilitados, ordenados por fecha.
  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, round, group_name, home_team, away_team, kickoff_at, is_active",
    )
    .eq("is_active", true)
    .order("kickoff_at", { ascending: true });

  // Predicciones propias.
  const { data: predictions } = await supabase
    .from("predictions")
    .select("match_id, predicted_home, predicted_away, predicted_winner")
    .eq("user_id", user!.id);

  const predByMatch = new Map(
    (predictions ?? []).map((p) => [p.match_id, p]),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Predicciones</h1>
        <Link href={`/pool/${params.id}`} className="text-sm underline">
          Volver al ranking
        </Link>
      </header>

      {(!matches || matches.length === 0) && (
        <p className="text-neutral-400">
          Aún no hay partidos habilitados para predecir.
        </p>
      )}

      <ul className="flex flex-col gap-6">
        {(matches ?? []).map((match) => {
          const pred = predByMatch.get(match.id);
          const locked = isPredictionLocked(match.kickoff_at);
          const knockout = isKnockoutRound(match.round as Round);

          return (
            <li
              key={match.id}
              className="rounded-xl border border-neutral-800 p-4"
            >
              <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                <span>{match.group_name ?? match.round}</span>
                <span className="flex items-center gap-2">
                  {new Date(match.kickoff_at).toLocaleString()}
                  <span>·</span>
                  {locked ? (
                    <span className="text-neutral-500">cerrado</span>
                  ) : (
                    <LockCountdown kickoffAt={match.kickoff_at} />
                  )}
                </span>
              </div>

              {locked ? (
                <p className="text-sm text-neutral-400">
                  {pred
                    ? `Tu predicción: ${pred.predicted_home}–${pred.predicted_away}`
                    : "No predijiste este partido."}
                </p>
              ) : (
                <PredictionForm
                  matchId={match.id}
                  homeTeam={match.home_team}
                  awayTeam={match.away_team}
                  isKnockout={knockout}
                  initialHome={pred?.predicted_home ?? null}
                  initialAway={pred?.predicted_away ?? null}
                  initialWinner={
                    (pred?.predicted_winner as MatchWinner | null) ?? null
                  }
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
