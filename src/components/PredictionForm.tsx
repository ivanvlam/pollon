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
}

export function PredictionForm({
  matchId,
  homeTeam,
  awayTeam,
  isKnockout,
  initialHome,
  initialAway,
  initialWinner,
}: Props) {
  const [home, setHome] = useState<string>(initialHome?.toString() ?? "");
  const [away, setAway] = useState<string>(initialAway?.toString() ?? "");
  const [winner, setWinner] = useState<MatchWinner | "">(initialWinner ?? "");
  const [state, setState] = useState<SaveState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(
    nextHome: string,
    nextAway: string,
    nextWinner: MatchWinner | "",
  ) {
    if (timer.current) clearTimeout(timer.current);

    const h = Number(nextHome);
    const a = Number(nextAway);
    if (nextHome === "" || nextAway === "" || Number.isNaN(h) || Number.isNaN(a)) {
      return;
    }
    if (isKnockout && nextWinner === "") return;

    setState("saving");
    timer.current = setTimeout(async () => {
      const result = await submitPrediction({
        matchId,
        predictedHome: h,
        predictedAway: a,
        predictedWinner: isKnockout ? (nextWinner as MatchWinner) : undefined,
      });
      if (result.ok) {
        setState("saved");
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

  return (
    <div className="flex flex-col gap-3">
      {/* Marcador estilo TV */}
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate text-sm font-medium sm:text-base">
            {homeTeam}
          </span>
          <Flag team={homeTeam} className="shrink-0" />
        </div>

        <Stepper
          value={home}
          ariaLabel={homeTeam}
          onChange={(v) => {
            setHome(v);
            scheduleSave(v, away, winner);
          }}
        />
        <span className="text-xl font-bold text-neutral-600">:</span>
        <Stepper
          value={away}
          ariaLabel={awayTeam}
          onChange={(v) => {
            setAway(v);
            scheduleSave(home, v, winner);
          }}
        />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Flag team={awayTeam} className="shrink-0" />
          <span className="truncate text-sm font-medium sm:text-base">
            {awayTeam}
          </span>
        </div>
      </div>

      {isKnockout && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-neutral-500">Clasifica:</span>
          <button
            type="button"
            aria-pressed={winner === "home"}
            className={chip(winner === "home")}
            onClick={() => {
              setWinner("home");
              scheduleSave(home, away, "home");
            }}
          >
            {homeTeam}
          </button>
          <button
            type="button"
            aria-pressed={winner === "away"}
            className={chip(winner === "away")}
            onClick={() => {
              setWinner("away");
              scheduleSave(home, away, "away");
            }}
          >
            {awayTeam}
          </button>
        </div>
      )}

      <p className="h-4 text-center text-xs" aria-live="polite">
        {state === "saving" && <span className="text-neutral-500">Guardando…</span>}
        {state === "saved" && <span className="text-emerald-400">Guardado ✓</span>}
        {state === "error" && <span className="text-red-400">{errorMsg}</span>}
      </p>
    </div>
  );
}
