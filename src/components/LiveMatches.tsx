"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { Flag } from "@/components/Flag";
import { GoalCelebration, type GoalEvent } from "@/components/GoalCelebration";
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

function useNow(intervalMs = 1_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}

function formatUpdatedAgoLabel(latestUpdateAt: string | null, now: number): string | null {
  if (!latestUpdateAt) return null;

  const latestUpdate = new Date(latestUpdateAt).getTime();
  if (Number.isNaN(latestUpdate)) return null;

  const agoSec = Math.floor((now - latestUpdate) / 1_000);
  if (agoSec <= 30) return "actualizado recién";
  if (agoSec <= 60) return `actualizado hace menos de 1 minuto`;
  if (agoSec <= 120) return "actualizado hace 1 minuto";
  return `actualizado hace ${Math.floor(agoSec / 60)} minutos`;
}

const GOAL_STORAGE_KEY = "pollon:goal-seen";

/**
 * Detecta goles en los partidos en vivo y los encola para celebrarlos:
 *  - al entrar a la página, si el partido tiene goles que aún no celebramos
 *    (último visto persistido en localStorage; en la primera visita el "antes"
 *    es 0-0, así un partido ya 1-0 también anima; el 0-0 nunca anima);
 *  - con la página abierta, cada vez que el marcador sube en un refresh.
 * Devuelve el gol actual a mostrar (uno a la vez, en cola) y su onDone.
 */
function useGoalCelebrations(matches: LiveMatchRow[]) {
  const seenRef = useRef<Map<string, { h: number; a: number }>>(new Map());
  const loadedRef = useRef(false);
  const [queue, setQueue] = useState<GoalEvent[]>([]);
  const [current, setCurrent] = useState<GoalEvent | null>(null);

  const signature = matches
    .map((m) => `${m.id}:${m.home_score ?? 0}-${m.away_score ?? 0}`)
    .join(",");

  useEffect(() => {
    const seen = seenRef.current;

    if (!loadedRef.current) {
      loadedRef.current = true;
      try {
        const raw = localStorage.getItem(GOAL_STORAGE_KEY);
        if (raw) {
          const obj = JSON.parse(raw) as Record<string, { h: number; a: number }>;
          for (const [id, v] of Object.entries(obj)) seen.set(id, v);
        }
      } catch {
        /* localStorage no disponible: seguimos sin persistencia */
      }
    }

    const events: GoalEvent[] = [];
    for (const m of matches) {
      const h = m.home_score ?? 0;
      const a = m.away_score ?? 0;
      // Primera vez que vemos el partido: tratamos el "antes" como 0-0, así
      // entrar con el partido ya 1-0 (o más) también dispara la animación.
      // El 0-0 nunca anima (no hay goles).
      const prev = seen.get(m.id) ?? { h: 0, a: 0 };
      if (h + a > prev.h + prev.a && h + a > 0) {
        const scoringSide = h - prev.h >= a - prev.a ? "home" : "away";
        events.push({
          id: `${m.id}-${h}-${a}-${Date.now()}`,
          homeTeam: m.home_team,
          awayTeam: m.away_team,
          homeScore: h,
          awayScore: a,
          scoringSide,
        });
      }
      seen.set(m.id, { h, a });
    }

    // Persistir solo los partidos vigentes (limpia los que ya no están en vivo).
    try {
      const obj: Record<string, { h: number; a: number }> = {};
      for (const m of matches) {
        const v = seen.get(m.id);
        if (v) obj[m.id] = v;
      }
      localStorage.setItem(GOAL_STORAGE_KEY, JSON.stringify(obj));
    } catch {
      /* sin persistencia */
    }

    if (events.length) setQueue((q) => [...q, ...events]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  // Promueve el siguiente de la cola cuando no hay nada mostrándose.
  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]!);
      setQueue((q) => q.slice(1));
    }
  }, [current, queue]);

  const onDone = useCallback(() => setCurrent(null), []);
  return { goal: current, onDone };
}

export function LiveMatches({
  matches,
  latestUpdateAt,
  poolId,
}: {
  matches: LiveMatchRow[];
  latestUpdateAt: string | null;
  poolId?: string | null;
}) {
  const router = useRouter();
  const now = useNow();
  const { goal, onDone } = useGoalCelebrations(matches);

  if (matches.length === 0) return null;

  const updatedAgoLabel = formatUpdatedAgoLabel(latestUpdateAt, now);

  return (
    <>
      {goal && <GoalCelebration goal={goal} onDone={onDone} />}
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
          · datos cada ~1 min{updatedAgoLabel ? ` · ${updatedAgoLabel}` : ""}
        </span>
      </div>

      <ul className="flex flex-col gap-3">
        {matches.map((m) => {
          const minute = liveProgressLabel(m.live_minute, m.kickoff_at);
          // Etiqueta de fase (solo grupos): "Fase de Grupos · Grupo X". Se
          // muestra arriba a la izquierda en desktop.
          const groupLabel =
            m.round === "group_stage" && m.group_name
              ? `Fase de Grupos · ${m.group_name.replace(/^Group\s+/i, "Grupo ")}`
              : null;
          // Versión corta para el chip presionable (visible también en móvil).
          const groupShort =
            m.round === "group_stage" && m.group_name
              ? m.group_name.replace(/^Group\s+/i, "Grupo ")
              : null;
          const groupHref = poolId ? `/pool/${poolId}/grupos` : null;
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
              {/* Fila superior: a la izquierda la fase (solo grupos, solo desktop);
                  a la derecha la fase del partido (mitad / entretiempo). En flujo
                  normal para que nunca se solape con nombres largos. Altura mínima
                  reservada aunque estén vacías, para uniformar las tarjetas. */}
              <div className="mb-1 flex min-h-[1rem] items-center justify-between gap-2">
                {groupShort && groupHref ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(groupHref);
                    }}
                    className="-ml-1.5 rounded px-1.5 py-0.5 text-xs font-medium text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100"
                  >
                    <span className="hidden sm:inline">Fase de Grupos · </span>
                    {groupShort}
                  </button>
                ) : groupLabel ? (
                  <span className="hidden text-xs font-medium text-neutral-500 sm:inline">
                    {groupLabel}
                  </span>
                ) : (
                  <span />
                )}
                {minute && (
                  <span className="text-xs font-medium text-neutral-400">{minute}</span>
                )}
              </div>

              {/* nombre bandera | marcador | bandera nombre */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
                <div className="flex min-w-0 items-center justify-end gap-1.5">
                  <TeamName
                    team={m.home_team}
                    className="text-right text-sm font-medium leading-tight sm:text-lg"
                  />
                  <Flag team={m.home_team} />
                </div>

                <div className="flex flex-col items-center px-2">
                  <span className="text-2xl font-bold tabular-nums text-neutral-100 sm:text-3xl">
                    {m.home_score ?? 0} – {m.away_score ?? 0}
                  </span>
                </div>

                <div className="flex min-w-0 items-center gap-1.5">
                  <Flag team={m.away_team} />
                  <TeamName
                    team={m.away_team}
                    className="text-sm font-medium leading-tight sm:text-lg"
                  />
                </div>
              </div>

              {/* Posición proyectada en el grupo: fila propia, alineada bajo cada
                  equipo (mismo lado que su nombre, separada del marcador). Solo
                  fase de grupos. */}
              {(m.homeProj || m.awayProj) && (
                <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
                  <div className="flex justify-end">
                    {m.homeProj && <GroupPosBadge proj={m.homeProj} />}
                  </div>
                  <div className="px-2" />
                  <div className="flex justify-start">
                    {m.awayProj && <GroupPosBadge proj={m.awayProj} />}
                  </div>
                </div>
              )}

              {/* Predicción + puntos provisionales. Mismo grid que el marcador
                  para que el "-" de la predicción quede alineado con el "–". */}
              {hasPred ? (
                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-x-2 text-xs">
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
                <div className="mt-4 text-center text-xs text-neutral-600">
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
    </>
  );
}
