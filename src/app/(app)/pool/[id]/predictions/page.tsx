import Link from "next/link";

import { Flag } from "@/components/Flag";
import { LockCountdown } from "@/components/LockCountdown";
import { PredictionForm } from "@/components/PredictionForm";
import { Card } from "@/components/ui/Card";
import { ROUNDS, isKnockoutRound, type Round } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { isPredictionLocked } from "@/lib/timing";
import type { MatchWinner } from "@/types";

const ROUND_LABELS: Record<Round, string> = {
  group_stage: "Fase de grupos",
  round_of_16: "Octavos de final",
  quarterfinal: "Cuartos de final",
  semifinal: "Semifinales",
  final: "Final",
};

export default async function PredictionsPage({
  params,
}: {
  params: { id: string };
}) {
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

  // Miembros de ESTA polla (para saber de quién revelar predicciones).
  const { data: members } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", params.id);
  const memberIds = (members ?? []).map((m) => m.user_id);
  const memberSet = new Set(memberIds);

  // Nombres.
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", memberIds.length > 0 ? memberIds : ["x"]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

  // Predicciones: la RLS devuelve TODAS las mías + las ajenas YA cerradas.
  const { data: allPreds } = await supabase
    .from("predictions")
    .select("user_id, match_id, predicted_home, predicted_away, predicted_winner")
    .in("match_id", matchIds.length > 0 ? matchIds : ["x"]);

  // Mis puntos por partido en esta polla.
  const { data: myScores } = await supabase
    .from("scores")
    .select("match_id, points")
    .eq("pool_id", params.id)
    .eq("user_id", uid);
  const pointsByMatch = new Map(
    (myScores ?? [])
      .filter((s) => s.match_id !== null)
      .map((s) => [s.match_id as string, s.points]),
  );

  const fmtScore = (h: number | null, a: number | null) =>
    h === null || a === null ? "—" : `${h}–${a}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Predicciones</h1>
        <Link
          href={`/pool/${params.id}`}
          className="text-sm text-emerald-400 hover:underline"
        >
          Volver al ranking
        </Link>
      </header>

      {(!matches || matches.length === 0) && (
        <p className="text-neutral-400">
          Aún no hay partidos habilitados para predecir.
        </p>
      )}

      {ROUNDS.map((round) => {
        const roundMatches = (matches ?? []).filter((m) => m.round === round);
        if (roundMatches.length === 0) return null;

        return (
          <section key={round} className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {ROUND_LABELS[round]}
            </h2>

            <div className="flex flex-col gap-4">
              {roundMatches.map((match) => {
                const locked = isPredictionLocked(match.kickoff_at);
                const knockout = isKnockoutRound(match.round as Round);
                const mine = (allPreds ?? []).find(
                  (p) => p.match_id === match.id && p.user_id === uid,
                );
                const others = (allPreds ?? []).filter(
                  (p) =>
                    p.match_id === match.id &&
                    p.user_id !== uid &&
                    memberSet.has(p.user_id),
                );
                const finished = match.status === "finished";
                const myPoints = pointsByMatch.get(match.id);

                return (
                  <Card key={match.id} className="p-4">
                    <div className="mb-3 flex items-center justify-between text-xs text-neutral-500">
                      <span>{match.group_name ?? ROUND_LABELS[round]}</span>
                      <span>
                        {new Date(match.kickoff_at).toLocaleString()}
                        {" · "}
                        {finished ? (
                          <span className="font-medium text-neutral-300">
                            Final {fmtScore(match.home_score, match.away_score)}
                          </span>
                        ) : locked ? (
                          <span>cerrado</span>
                        ) : (
                          <LockCountdown kickoffAt={match.kickoff_at} />
                        )}
                      </span>
                    </div>

                    {!locked ? (
                      <PredictionForm
                        matchId={match.id}
                        homeTeam={match.home_team}
                        awayTeam={match.away_team}
                        isKnockout={knockout}
                        initialHome={mine?.predicted_home ?? null}
                        initialAway={mine?.predicted_away ?? null}
                        initialWinner={
                          (mine?.predicted_winner as MatchWinner | null) ?? null
                        }
                      />
                    ) : (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 font-medium">
                            <Flag team={match.home_team} />
                            {match.home_team}
                            <span className="text-neutral-500">vs</span>
                            {match.away_team}
                            <Flag team={match.away_team} />
                          </span>
                          {myPoints !== undefined && (
                            <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                              +{myPoints} pts
                            </span>
                          )}
                        </div>

                        {/* Predicciones reveladas: la mía + las de la polla */}
                        <ul className="flex flex-col gap-1 text-sm">
                          <li className="flex justify-between text-neutral-300">
                            <span>Tú</span>
                            <span>
                              {mine
                                ? `${fmtScore(mine.predicted_home, mine.predicted_away)}${
                                    mine.predicted_winner
                                      ? ` · ${mine.predicted_winner === "home" ? match.home_team : match.away_team}`
                                      : ""
                                  }`
                                : "sin predicción"}
                            </span>
                          </li>
                          {others.map((p) => (
                            <li
                              key={p.user_id}
                              className="flex justify-between text-neutral-400"
                            >
                              <span>{nameById.get(p.user_id) ?? "—"}</span>
                              <span>
                                {fmtScore(p.predicted_home, p.predicted_away)}
                                {p.predicted_winner
                                  ? ` · ${p.predicted_winner === "home" ? match.home_team : match.away_team}`
                                  : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
