"use client";

import { useRouter } from "next/navigation";

import { Flag } from "@/components/Flag";
import { MatchLiveRefresh } from "@/components/MatchLiveRefresh";
import { TeamName } from "@/components/TeamName";
import { liveProgressLabel } from "@/lib/liveMinute";
import { calculateMatchScore } from "@/lib/scoring";
import type { LivePosition } from "@/lib/standings";
import type { MatchWinner, Round } from "@/types";

export interface LiveMatchRow {
  id: string;
  round: Round;
  group_name: string | null;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  live_minute: string | null;
  kickoff_at: string;
  pred: {
    predicted_home: number | null;
    predicted_away: number | null;
    predicted_winner: string | null;
  } | null;
  // Posición proyectada en el grupo si el marcador en vivo se mantiene.
  // Solo presente en partidos de fase de grupos.
  homeProj: LivePosition | null;
  awayProj: LivePosition | null;
}

/** Recuadro parpadeante con la posición proyectada en el grupo. */
function GroupPosBadge({ proj }: { proj: LivePosition }) {
  const style =
    proj.dir === "up"
      ? { box: "bg-emerald-500/15 text-emerald-400", symbol: "↑", verb: "subiría a" }
      : proj.dir === "down"
        ? { box: "bg-red-500/15 text-red-400", symbol: "↓", verb: "bajaría a" }
        : { box: "bg-neutral-500/15 text-neutral-400", symbol: "–", verb: "se mantiene" };
  return (
    <span
      aria-label={`Posición en el grupo: ${style.verb} ${proj.pos}°`}
      className={`inline-flex animate-pulse items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium leading-none tabular-nums ${style.box}`}
    >
      <span aria-hidden>{style.symbol}</span>
      <span aria-hidden>{proj.pos}°</span>
    </span>
  );
}

export function LiveMatches({
  matches,
  updatedAgoLabel,
  poolId,
}: {
  matches: LiveMatchRow[];
  updatedAgoLabel: string | null;
  poolId?: string | null;
}) {
  const router = useRouter();

  if (matches.length === 0) return null;

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <MatchLiveRefresh matches={[{ status: "live" }]} />
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-400">
            En vivo
          </h2>
        </span>
        <span className="text-xs text-neutral-500">
          · datos cada ~10 min{updatedAgoLabel ? ` · ${updatedAgoLabel}` : ""}
        </span>
      </div>

      <ul className="flex flex-col gap-3">
        {matches.map((m) => {
          const minute = liveProgressLabel(m.live_minute, m.kickoff_at);
          const hasPred =
            m.pred !== null &&
            m.pred.predicted_home !== null &&
            m.pred.predicted_away !== null;

          // Puntos provisionales: lo que ganaría si el partido terminara ahora.
          // Para eliminatorias, winner es null en vivo → calculateMatchScore devuelve null.
          const liveScore =
            hasPred && m.home_score !== null && m.away_score !== null
              ? calculateMatchScore(
                  {
                    round: m.round,
                    home_score: m.home_score,
                    away_score: m.away_score,
                    winner: null,
                  },
                  {
                    predicted_home: m.pred!.predicted_home,
                    predicted_away: m.pred!.predicted_away,
                    predicted_winner:
                      (m.pred!.predicted_winner as MatchWinner | null) ?? null,
                  },
                )
              : null;

          const href = poolId ? `/pool/${poolId}/predictions?from=home` : null;
          const cardClass =
            "block rounded-lg bg-neutral-900/50 px-4 py-3 transition hover:bg-neutral-800/60";

          const inner = (
            <>
              {/* Fase del partido (mitad / entretiempo), en fila propia arriba a la
                  derecha — en flujo normal para que nunca se solape con nombres largos.
                  Altura mínima reservada aunque no haya fase, para uniformar las tarjetas. */}
              <div className="mb-1 flex min-h-[1rem] justify-end">
                {minute && (
                  <span className="text-xs font-medium text-neutral-400">{minute}</span>
                )}
              </div>

              {/* nombre bandera | marcador | bandera nombre.
                  El badge de posición se posiciona en absolute, centrado bajo el
                  NOMBRE de cada país, sin alterar la alineación del marcador. El
                  padding inferior reserva su espacio. Solo fase de grupos. */}
              <div
                className={`grid grid-cols-[1fr_auto_1fr] items-center gap-x-2${
                  m.homeProj || m.awayProj ? " pb-6" : ""
                }`}
              >
                <div className="flex min-w-0 items-center justify-end gap-1.5">
                  <span className="relative inline-flex">
                    <TeamName
                      team={m.home_team}
                      className="text-right text-sm font-medium leading-tight sm:text-lg"
                    />
                    {m.homeProj && (
                      <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2">
                        <GroupPosBadge proj={m.homeProj} />
                      </span>
                    )}
                  </span>
                  <Flag team={m.home_team} />
                </div>

                <div className="flex flex-col items-center px-2">
                  <span className="text-2xl font-bold tabular-nums text-neutral-100 sm:text-3xl">
                    {m.home_score ?? 0} – {m.away_score ?? 0}
                  </span>
                </div>

                <div className="flex min-w-0 items-center justify-start gap-1.5">
                  <Flag team={m.away_team} />
                  <span className="relative inline-flex">
                    <TeamName
                      team={m.away_team}
                      className="text-sm font-medium leading-tight sm:text-lg"
                    />
                    {m.awayProj && (
                      <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2">
                        <GroupPosBadge proj={m.awayProj} />
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Predicción + puntos provisionales. Mismo grid que el marcador
                  para que el "-" de la predicción quede alineado con el "–". */}
              {hasPred ? (
                <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 text-xs">
                  <span className="text-right text-neutral-500">Tu predicción:</span>
                  <span className="px-2 font-medium tabular-nums text-neutral-200">
                    {m.pred!.predicted_home}-{m.pred!.predicted_away}
                  </span>
                  <span className="justify-self-start">
                    {liveScore ? (
                      <span className="animate-pulse rounded bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-400">
                        +{liveScore.points} puntos
                      </span>
                    ) : (
                      <span className="text-neutral-600">· 0 puntos</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="mt-2.5 text-center text-xs text-neutral-600">
                  No predijiste este partido
                </div>
              )}
            </>
          );

          return (
            <li key={m.id}>
              {href ? (
                <div
                  className={cardClass + " cursor-pointer"}
                  onClick={() => router.push(href)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") router.push(href);
                  }}
                >
                  {inner}
                </div>
              ) : (
                <div className={cardClass}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
