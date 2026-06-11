"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

/**
 * Refresca la página (Server Components) cada `intervalMs` mientras haya al
 * menos un partido en vivo, para que el marcador EN VIVO se actualice sin que
 * el usuario recargue a mano. NO consume cuota de TheSportsDB: router.refresh()
 * solo vuelve a leer NUESTRA base (Supabase); el único que le habla a la API
 * externa es el cron. Si no hay partidos live, no arma ningún intervalo.
 */
export function MatchLiveRefresh({
  matches,
  intervalMs = 60_000,
}: {
  matches: ReadonlyArray<{ status: string }>;
  intervalMs?: number;
}) {
  const router = useRouter();
  const hasLive = matches.some((m) => m.status === "live");

  useEffect(() => {
    if (!hasLive) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [hasLive, intervalMs, router]);

  return null;
}
