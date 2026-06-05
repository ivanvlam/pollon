import Link from "next/link";

import { Flag } from "@/components/Flag";
import { createClient } from "@/lib/supabase/server";
import type { MatchWinner, Round } from "@/types";

export const metadata = { title: "Bracket" };

// FIFA no ha publicado los cruces del R32 para 2026.
const R32_SLOTS: { home: string; away: string }[] = Array.from({ length: 16 }, () => ({
  home: "Por definir",
  away: "Por definir",
}));

const KNOCKOUT: { round: Round; label: string; slots: number }[] = [
  { round: "round_of_32", label: "Dieciseisavos", slots: 16 },
  { round: "round_of_16", label: "Octavos", slots: 8 },
  { round: "quarterfinal", label: "Cuartos", slots: 4 },
  { round: "semifinal", label: "Semis", slots: 2 },
  { round: "final", label: "Final", slots: 1 },
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
    .in("round", KNOCKOUT.map((k) => k.round))
    .order("kickoff_at", { ascending: true });

  const all = matches ?? [];

  const { data: myPreds } = await supabase
    .from("predictions")
    .select("match_id, predicted_home, predicted_away, predicted_winner")
    .eq("user_id", uid)
    .in("match_id", all.length > 0 ? all.map((m) => m.id) : ["x"]);
  const predByMatch = new Map((myPreds ?? []).map((p) => [p.match_id, p]));

  const matchesByRound = new Map<Round, typeof all>();
  for (const k of KNOCKOUT) {
    matchesByRound.set(k.round, all.filter((m) => m.round === k.round));
  }

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

      <p className="text-xs text-neutral-500">
        Deslizá horizontalmente para ver todas las rondas.
      </p>

      <div className="overflow-x-auto pb-4">
        <div className="flex min-w-max items-start gap-3">
          {KNOCKOUT.map((stage) => {
            const roundMatches = matchesByRound.get(stage.round) ?? [];

            const slots = Array.from({ length: stage.slots }, (_, i) => {
              const real = roundMatches[i] ?? null;
              const placeholder = stage.round === "round_of_32" ? (R32_SLOTS[i] ?? null) : null;
              return { real, placeholder, i };
            });

            return (
              <section key={stage.round} className="flex w-48 shrink-0 flex-col gap-2">
                <h2 className="text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  {stage.label}
                </h2>

                <div className="flex flex-col gap-2">
                  {slots.map(({ real, placeholder, i }) => {
                    if (real) {
                      const m = real;
                      const finished = m.status === "finished";
                      const pred = predByMatch.get(m.id);
                      const homeVal = finished ? m.home_score : (pred?.predicted_home ?? null);
                      const awayVal = finished ? m.away_score : (pred?.predicted_away ?? null);
                      const winner: MatchWinner | null = finished
                        ? (m.winner as MatchWinner | null)
                        : ((pred?.predicted_winner as MatchWinner | null) ?? null);

                      return (
                        <Link
                          key={m.id}
                          href={`/pool/${params.id}/predictions#m-${m.id}`}
                          className="block rounded-lg border border-neutral-700 bg-neutral-900/60 p-2 text-xs transition hover:border-neutral-500"
                        >
                          <TeamLine team={m.home_team} value={homeVal} win={winner === "home"} />
                          <div className="my-1 border-t border-neutral-800" />
                          <TeamLine team={m.away_team} value={awayVal} win={winner === "away"} />
                          <p className="mt-1 text-[10px] text-neutral-600">
                            {finished ? "Resultado" : pred ? "Tu pronóstico" : "Sin pronóstico"}
                          </p>
                        </Link>
                      );
                    }

                    return (
                      <div
                        key={i}
                        className="rounded-lg border border-dashed border-neutral-800 bg-neutral-950/60 p-2 text-xs"
                      >
                        <PlaceholderLine label={placeholder?.home ?? "Por definir"} />
                        <div className="my-1 border-t border-neutral-900" />
                        <PlaceholderLine label={placeholder?.away ?? "Por definir"} />
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
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
      className={`flex items-center justify-between gap-1 ${
        win ? "font-semibold text-emerald-400" : "text-neutral-300"
      }`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <Flag team={team} />
        <span className="truncate">{team}</span>
      </span>
      <span className="tabular-nums">{value ?? "-"}</span>
    </div>
  );
}

function PlaceholderLine({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between gap-1 text-neutral-600">
      <span className="truncate">{label}</span>
      <span>-</span>
    </div>
  );
}
