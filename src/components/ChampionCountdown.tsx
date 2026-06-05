"use client";

import { useEffect, useState } from "react";

import { formatCountdown, msUntilChampionLock } from "@/lib/timing";

export function ChampionCountdown({ firstKickoffAt }: { firstKickoffAt: string | null }) {
  const [remaining, setRemaining] = useState<number>(() =>
    msUntilChampionLock(firstKickoffAt),
  );

  useEffect(() => {
    setRemaining(msUntilChampionLock(firstKickoffAt));
    const id = setInterval(() => {
      setRemaining(msUntilChampionLock(firstKickoffAt));
    }, 30_000);
    return () => clearInterval(id);
  }, [firstKickoffAt]);

  if (!firstKickoffAt) return null;

  if (remaining <= 0) {
    return (
      <span className="rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-500">
        Predicciones cerradas
      </span>
    );
  }

  const closingSoon = remaining <= 3 * 3_600_000;
  return (
    <span className={`rounded-full px-3 py-1 text-xs ${closingSoon ? "bg-amber-900/40 text-amber-400" : "bg-neutral-800 text-neutral-400"}`}>
      Cierra en {formatCountdown(remaining)}
    </span>
  );
}
