"use client";

import { useEffect, useState } from "react";

import { formatCountdown, msUntilLock } from "@/lib/timing";

/**
 * Countdown en vivo hasta el cierre de la predicción (24h antes del
 * kickoff). Se actualiza cada 30s. Es solo informativo: la validación
 * real ocurre en el servidor (submit_prediction).
 */
export function LockCountdown({ kickoffAt }: { kickoffAt: string }) {
  const [remaining, setRemaining] = useState<number>(() =>
    msUntilLock(kickoffAt),
  );

  useEffect(() => {
    setRemaining(msUntilLock(kickoffAt));
    const id = setInterval(() => {
      setRemaining(msUntilLock(kickoffAt));
    }, 30_000);
    return () => clearInterval(id);
  }, [kickoffAt]);

  const closingSoon = remaining > 0 && remaining <= 3 * 3_600_000; // < 3h

  if (remaining <= 0) {
    return <span className="text-neutral-500">Cerrado</span>;
  }

  return (
    <span className={closingSoon ? "text-amber-400" : "text-neutral-400"}>
      Cierra en {formatCountdown(remaining)}
    </span>
  );
}
