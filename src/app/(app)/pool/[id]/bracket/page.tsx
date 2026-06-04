import Link from "next/link";

import { Flag } from "@/components/Flag";
import { createClient } from "@/lib/supabase/server";
import type { MatchWinner, Round } from "@/types";

export const metadata = { title: "Bracket" };

const KNOCKOUT: { round: Round; label: string }[] = [
  { round: "round_of_16", label: "Octavos" },
  { round: "quarterfinal", label: "Cuartos" },
  { round: "semifinal", label: "Semis" },
  { round: "final", label: "Final" },
];

export default async function BracketPage({
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
      "id, round, home_team, away_team, kickoff_at, status, home_score, away_score, winner",
    )
    .in(
      "round",
      KNOCKOUT.map((k) => k.round),
    )
    .order("kickoff_at", { ascending: true });

  const all = matches ?? [];

  const { data: myPreds } = await supabase
    .from("predictions")
    .select("match_id, predicted_home, predicted_away, predicted_winner")
    .eq("user_id", uid)
    .in("match_id", all.length > 0 ? all.map((m) => m.id) : ["x"]);
  const predByMatch = new Map((myPreds ?? []).map((p) => [p.match_id, p]));

  const rounds = KNOCKOUT.map((k) => ({
    ...k,
    matches: all.filter((m) => m.round === k.round),
  })).filter((r) => r.matches.length > 0);

  const hasAny = rounds.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bracket</h1>
        <Link
          href={`/pool/${params.id}`}
          className="text-sm text-emerald-400 hover:underline"
        >
          Volver al ranking
        </Link>
      </header>

      {!hasAny && (
        <p className="text-neutral-400">
          Las eliminatorias aparecerán cuando el admin las habilite.
        </p>
      )}

      {/* Móvil: columnas apiladas. Desktop: árbol horizontal centrado. */}
      <div className="flex flex-col gap-8 md:flex-row md:items-stretch md:gap-4 md:overflow-x-auto md:pb-2">
        {rounds.map((r) => (
          <section
            key={r.round}
            className="flex flex-col gap-3 md:min-w-[230px] md:justify-around"
          >
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {r.label}
            </h2>

            {r.matches.map((m) => {
              const finished = m.status === "finished";
              const pred = predByMatch.get(m.id);
              const isFinal = r.round === "final";

              // Qué mostrar: resultado real si terminó, si no tu pronóstico.
              const homeVal = finished ? m.home_score : pred?.predicted_home;
              const awayVal = finished ? m.away_score : pred?.predicted_away;
              const winner: MatchWinner | null = finished
                ? (m.winner as MatchWinner | null)
                : ((pred?.predicted_winner as MatchWinner | null) ?? null);

              return (
                <Link
                  key={m.id}
                  href={`/pool/${params.id}/predictions#m-${m.id}`}
                  className="relative block rounded-lg border border-neutral-800 bg-neutral-900/40 p-2 text-sm transition hover:border-neutral-600"
                >
                  <TeamLine
                    team={m.home_team}
                    value={homeVal ?? null}
                    win={winner === "home"}
                  />
                  <div className="my-1 border-t border-neutral-900" />
                  <TeamLine
                    team={m.away_team}
                    value={awayVal ?? null}
                    win={winner === "away"}
                  />
                  <p className="mt-1 text-[10px] text-neutral-500">
                    {finished
                      ? "Resultado"
                      : pred
                        ? "Tu pronóstico"
                        : "Sin pronóstico"}
                  </p>

                  {/* Conector hacia la siguiente ronda (solo desktop) */}
                  {!isFinal && (
                    <span
                      aria-hidden
                      className="absolute left-full top-1/2 hidden h-px w-4 bg-neutral-700 md:block"
                    />
                  )}
                </Link>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
}

function TeamLine({
  team,
  value,
  win,
}: {
  team: string;
  value: number | null;
  win: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 ${
        win ? "font-semibold text-emerald-400" : "text-neutral-300"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Flag team={team} />
        <span className="truncate">{team}</span>
      </span>
      <span className="tabular-nums">{value ?? "-"}</span>
    </div>
  );
}
