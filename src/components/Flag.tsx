"use client";

import { cn } from "@/lib/cn";
import { flagUrl, teamFlagCode } from "@/lib/flags";

/**
 * Bandera de un equipo (flagcdn). Si el nombre no se reconoce, no renderiza
 * nada (el equipo se muestra solo con su nombre).
 */
export function Flag({ team, className }: { team: string; className?: string }) {
  const code = teamFlagCode(team);
  if (!code) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={flagUrl(code)}
      srcSet={`${flagUrl(code, true)} 2x`}
      width={24}
      height={18}
      alt=""
      loading="lazy"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      className={cn("inline-block h-[18px] w-[24px] rounded-sm object-cover", className)}
    />
  );
}
