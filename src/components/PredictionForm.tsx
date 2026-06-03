"use client";

import { useRef, useState } from "react";

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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="w-28 truncate text-right text-sm">{homeTeam}</span>
        <input
          type="number"
          min={0}
          max={99}
          value={home}
          onChange={(e) => {
            setHome(e.target.value);
            scheduleSave(e.target.value, away, winner);
          }}
          className="w-14 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-center"
        />
        <span className="text-neutral-500">–</span>
        <input
          type="number"
          min={0}
          max={99}
          value={away}
          onChange={(e) => {
            setAway(e.target.value);
            scheduleSave(home, e.target.value, winner);
          }}
          className="w-14 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-center"
        />
        <span className="w-28 truncate text-sm">{awayTeam}</span>
      </div>

      {isKnockout && (
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-400">Clasifica:</span>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name={`winner-${matchId}`}
              checked={winner === "home"}
              onChange={() => {
                setWinner("home");
                scheduleSave(home, away, "home");
              }}
            />
            {homeTeam}
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name={`winner-${matchId}`}
              checked={winner === "away"}
              onChange={() => {
                setWinner("away");
                scheduleSave(home, away, "away");
              }}
            />
            {awayTeam}
          </label>
        </div>
      )}

      <p className="h-4 text-xs">
        {state === "saving" && <span className="text-neutral-500">Guardando…</span>}
        {state === "saved" && <span className="text-green-500">Guardado ✓</span>}
        {state === "error" && <span className="text-red-400">{errorMsg}</span>}
      </p>
    </div>
  );
}
