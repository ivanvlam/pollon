"use client";

import { useRef, useState } from "react";

import { Flag } from "@/components/Flag";
import { Stepper } from "@/components/Stepper";
import { cn } from "@/lib/cn";
import { PREDICTION_DEBOUNCE_MS } from "@/lib/constants";
import { submitPrediction } from "@/lib/predictions/actions";
import type { MatchWinner } from "@/types";

type SaveState = "idle" | "saving" | "saved" | "error";

interface Props {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  isKnockout: boolean;
  initialHome: number | null;
  initialAway: number | null;
  initialWinner: MatchWinner | null;
  onSaved?: (matchId: string, home: number, away: number, winner: MatchWinner | null) => void;
  homeTeamEl?: React.ReactNode;
  awayTeamEl?: React.ReactNode;
}

export function PredictionForm({
  matchId,
  homeTeam,
  awayTeam,
  isKnockout,
  initialHome,
  initialAway,
  initialWinner,
  onSaved,
  homeTeamEl,
  awayTeamEl,
}: Props) {
  const [home, setHome] = useState<string>(initialHome?.toString() ?? "");
  const [away, setAway] = useState<string>(initialAway?.toString() ?? "");
  // Solo se usa cuando el marcador es empate (clasifica por penales).
  const [drawWinner, setDrawWinner] = useState<MatchWinner | "">(
    initialHome !== null && initialHome === initialAway
      ? (initialWinner ?? "")
      : "",
  );
  const [state, setState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const homeN = home === "" ? null : Number(home);
  const awayN = away === "" ? null : Number(away);
  const isDraw = homeN !== null && awayN !== null && homeN === awayN;

  function scheduleSave(
    nextHome: string,
    nextAway: string,
    nextDrawWinner: MatchWinner | "",
  ) {
    if (timer.current) clearTimeout(timer.current);

    const h = Number(nextHome);
    const a = Number(nextAway);
    if (nextHome === "" || nextAway === "" || Number.isNaN(h) || Number.isNaN(a)) {
      return;
    }

    let winner: MatchWinner | undefined;
    if (isKnockout) {
      if (h === a) {
        // Empate: el clasificado se elige explícitamente (penales).
        if (nextDrawWinner === "") return;
        winner = nextDrawWinner as MatchWinner;
      } else {
        // Marcador no-empate: clasifica el ganador del 90'.
        winner = h > a ? "home" : "away";
      }
    }

    setState("saving");
    timer.current = setTimeout(async () => {
      const result = await submitPrediction({
        matchId,
        predictedHome: h,
        predictedAway: a,
        predictedWinner: winner,
      });
      if (result.ok) {
        setState("saved");
        onSaved?.(matchId, h, a, winner ?? null);
      } else {
        setState("error");
        setErrorMsg(result.error);
      }
    }, PREDICTION_DEBOUNCE_MS);
  }

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs transition",
      active
        ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
        : "border-neutral-700 text-neutral-400 hover:bg-neutral-800",
    );

  // Clasificado derivado (para el cartelito informativo cuando no es empate).
  const derivedQualifier =
    isKnockout && homeN !== null && awayN !== null && homeN !== awayN
      ? homeN > awayN
        ? homeTeam
        : awayTeam
      : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Nombres en mobile (fila separada): los steppers no dejan espacio inline */}
      <div className="flex items-center justify-between gap-2 text-sm font-medium sm:hidden">
        <span className="flex min-w-0 items-center gap-1.5">
          <Flag team={homeTeam} className="shrink-0" />
          {homeTeamEl ?? <span className="truncate">{homeTeam}</span>}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {awayTeamEl ?? <span className="truncate">{awayTeam}</span>}
          <Flag team={awayTeam} className="shrink-0" />
        </span>
      </div>

      {/* Marcador estilo TV */}
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        <div className="hidden min-w-0 flex-1 items-center justify-end gap-2 sm:flex">
          {homeTeamEl ?? <span className="truncate text-sm font-medium sm:text-base">{homeTeam}</span>}
          <Flag team={homeTeam} className="shrink-0" />
        </div>

        <Stepper
          value={home}
          ariaLabel={homeTeam}
          onChange={(v) => {
            setHome(v);
            scheduleSave(v, away, drawWinner);
          }}
        />
        <span className="text-xl font-bold text-neutral-600">:</span>
        <Stepper
          value={away}
          ariaLabel={awayTeam}
          onChange={(v) => {
            setAway(v);
            scheduleSave(home, v, drawWinner);
          }}
        />

        <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
          <Flag team={awayTeam} className="shrink-0" />
          {awayTeamEl ?? <span className="truncate text-sm font-medium sm:text-base">{awayTeam}</span>}
        </div>
      </div>

      {/* En eliminatorias el clasificado solo se pregunta si es empate */}
      {isKnockout && isDraw && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-neutral-500">Clasifica (prórroga/penales):</span>
          <button
            type="button"
            aria-pressed={drawWinner === "home"}
            className={chip(drawWinner === "home")}
            onClick={() => {
              setDrawWinner("home");
              scheduleSave(home, away, "home");
            }}
          >
            {homeTeam}
          </button>
          <button
            type="button"
            aria-pressed={drawWinner === "away"}
            className={chip(drawWinner === "away")}
            onClick={() => {
              setDrawWinner("away");
              scheduleSave(home, away, "away");
            }}
          >
            {awayTeam}
          </button>
        </div>
      )}

      {derivedQualifier && (
        <p className="text-center text-xs text-neutral-500">
          Clasifica: <span className="text-neutral-300">{derivedQualifier}</span>
        </p>
      )}

      <p className="h-4 text-center text-xs" aria-live="polite">
        {state === "saving" && <span className="text-neutral-500">Guardando…</span>}
        {state === "saved" && <span className="text-emerald-400">Guardado ✓</span>}
        {state === "error" && <span className="text-red-400">{errorMsg}</span>}
      </p>
    </div>
  );
}
