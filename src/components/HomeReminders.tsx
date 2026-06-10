"use client";

import { useEffect, useState } from "react";

import Link from "next/link";

import { Flag } from "@/components/Flag";
import { toSpanish } from "@/lib/teamNames";
import { formatCountdown, msUntilChampionLock, parseKickoff } from "@/lib/timing";

interface NextMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
}

interface NextPrediction {
  home: number | null;
  away: number | null;
  winner: string | null;
}

interface Props {
  firstKickoffAt: string | null;
  hasChampion: boolean;
  hasTopScorer: boolean;
  nextMatch: NextMatch | null;
  nextPrediction: NextPrediction | null;
  /** Polla a la que apunta el link "Predecir" (cualquiera del usuario). */
  predictPoolId: string | null;
}

const DATE_FMT = new Intl.DateTimeFormat("es", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export function HomeReminders({
  firstKickoffAt,
  hasChampion,
  hasTopScorer,
  nextMatch,
  nextPrediction,
  predictPoolId,
}: Props) {
  // Tick cada 30s para que los countdown queden vivos (y se calcula en el
  // browser → tz correcta del usuario).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const championMs = msUntilChampionLock(firstKickoffAt, now);
  const championOpen = firstKickoffAt !== null && championMs > 0;
  const missingChampion = !hasChampion;
  const missingTopScorer = !hasTopScorer;
  const showSpecialReminder =
    championOpen && (missingChampion || missingTopScorer);

  const missingLabel = missingChampion
    ? missingTopScorer
      ? "campeón ni goleador"
      : "campeón"
    : "goleador";

  const kickoffMs = nextMatch ? parseKickoff(nextMatch.kickoffAt) - now : 0;

  if (!showSpecialReminder && !nextMatch) return null;

  return (
    <div className="flex flex-col gap-3">
      {showSpecialReminder && (
        <Link
          href="/champion"
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/50 bg-amber-500/5 p-4 transition hover:border-amber-400"
        >
          <span className="text-sm text-amber-200">
            ⏰ <strong>Apúrate:</strong> aún no eliges {missingLabel}.{" "}
            <span className="text-amber-400">
              Cierra en {formatCountdown(championMs)}
            </span>
          </span>
          <span className="shrink-0 text-sm font-medium text-amber-400">
            Elegir →
          </span>
        </Link>
      )}

      {nextMatch && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Próximo partido
            </h2>
            {kickoffMs > 0 && (
              <span className="text-xs text-neutral-400">
                dentro de {formatCountdown(kickoffMs)}
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-2 text-base font-medium">
            <Flag team={nextMatch.homeTeam} />
            {toSpanish(nextMatch.homeTeam)}
            <span className="text-neutral-500">vs</span>
            {toSpanish(nextMatch.awayTeam)}
            <Flag team={nextMatch.awayTeam} />
          </div>

          <p className="mt-1 text-sm capitalize text-neutral-400">
            {DATE_FMT.format(new Date(nextMatch.kickoffAt))}
          </p>

          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className="text-neutral-300">
              {nextPrediction &&
              nextPrediction.home !== null &&
              nextPrediction.away !== null ? (
                <>
                  Tu predicción:{" "}
                  <strong>
                    {nextPrediction.home}-{nextPrediction.away}
                  </strong>
                  {nextPrediction.winner
                    ? ` · ${
                        nextPrediction.winner === "home"
                          ? toSpanish(nextMatch.homeTeam)
                          : toSpanish(nextMatch.awayTeam)
                      }`
                    : ""}
                </>
              ) : (
                <span className="text-amber-400">Aún no tienes predicción</span>
              )}
            </span>
            {predictPoolId && (
              <Link
                href={`/pool/${predictPoolId}/predictions#m-${nextMatch.id}`}
                className="shrink-0 font-medium text-emerald-400 hover:underline"
              >
                Predecir →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
