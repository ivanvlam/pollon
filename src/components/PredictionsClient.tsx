"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import { Flag } from "@/components/Flag";
import { LockCountdown } from "@/components/LockCountdown";
import { PredictionForm } from "@/components/PredictionForm";
import { TeamName } from "@/components/TeamName";
import { Card } from "@/components/ui/Card";
import { isKnockoutRound, ROUNDS, type Round } from "@/lib/constants";
import { REASON_LABELS, ROUND_LABELS } from "@/lib/labels";
import { liveProgressLabel } from "@/lib/liveMinute";
import { calculateMatchScore, liveKnockoutWinner, regulationScore, type MatchScore } from "@/lib/scoring";
import { toSpanish } from "@/lib/teamNames";
import { hasMatchStarted, isPredictionLocked } from "@/lib/timing";
import type { MatchWinner } from "@/types";

interface MatchData {
  id: string;
  round: Round;
  group_name: string | null;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  home_score_90: number | null;
  away_score_90: number | null;
  home_pen: number | null;
  away_pen: number | null;
  winner: string | null;
  is_active: boolean;
  live_minute: string | null;
}

interface PredData {
  user_id: string;
  match_id: string;
  predicted_home: number | null;
  predicted_away: number | null;
  predicted_winner: string | null;
}

interface Props {
  poolId: string;
  uid: string;
  matches: MatchData[];
  allPreds: PredData[];
  nameById: Record<string, string>;
  pointsByMatch: Record<string, number>;
  memberIds: string[];
}

type SortKey = "kickoff_asc" | "kickoff_desc" | "group_asc" | "group_desc";
type PredFilter = "all" | "with" | "without";
type StatusFilter = "pending" | "finished" | "all";

// Fecha/hora del partido en la timezone del navegador, legible (ej. "sáb 14 jun, 15:00").
const DATE_FMT = new Intl.DateTimeFormat("es", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

// TheSportsDB devuelve "Group A", la app está en español → "Grupo A"
const displayGroup = (name: string) => name.replace(/^Group\s+/i, "Grupo ");


export function PredictionsClient({
  poolId,
  uid,
  matches,
  allPreds,
  nameById,
  pointsByMatch,
  memberIds,
}: Props) {
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("kickoff_asc");
  const [predFilter, setPredFilter] = useState<PredFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");

  // Set de matchIds con predicción propia — se actualiza optimistamente cuando
  // PredictionForm guarda, sin esperar a que el servidor re-renderice.
  const [savedMatchIds, setSavedMatchIds] = useState<Set<string>>(
    () => new Set(allPreds.filter((p) => p.user_id === uid).map((p) => p.match_id)),
  );

  // Valores de predicción guardados localmente para que el form no pierda los
  // datos si se desmonta y vuelve a montar por un cambio de filtro.
  const [localPreds, setLocalPreds] = useState<Map<string, { home: number; away: number; winner: string | null }>>(
    () => new Map(),
  );

  const memberSet = useMemo(() => new Set(memberIds), [memberIds]);

  const groups = useMemo(
    () =>
      [...new Set(matches.filter((m) => m.group_name).map((m) => m.group_name!))].sort(),
    [matches],
  );

  const myPredByMatch = useMemo(
    () =>
      new Map(allPreds.filter((p) => p.user_id === uid).map((p) => [p.match_id, p])),
    [allPreds, uid],
  );

  const othersByMatch = useMemo(() => {
    const map = new Map<string, PredData[]>();
    for (const p of allPreds) {
      if (p.user_id === uid || !memberSet.has(p.user_id)) continue;
      const list = map.get(p.match_id) ?? [];
      list.push(p);
      map.set(p.match_id, list);
    }
    return map;
  }, [allPreds, uid, memberSet]);

  const anyFilter =
    search.trim() !== "" || groupFilter !== null || predFilter !== "all";

  const filtered = useMemo(() => {
    let result = [...matches];

    if (statusFilter === "pending") {
      result = result.filter((m) => m.status !== "finished");
    } else if (statusFilter === "finished") {
      result = result.filter((m) => m.status === "finished");
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (m) =>
          m.home_team.toLowerCase().includes(q) ||
          m.away_team.toLowerCase().includes(q),
      );
    }

    if (groupFilter) {
      result = result.filter((m) => m.group_name === groupFilter);
    }

    if (predFilter !== "all") {
      result = result.filter((m) => {
        const has = savedMatchIds.has(m.id);
        return predFilter === "with" ? has : !has;
      });
    }

    result.sort((a, b) => {
      if (sort === "kickoff_asc")
        return new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime();
      if (sort === "kickoff_desc")
        return new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime();
      if (sort === "group_asc")
        return (a.group_name ?? "zzz").localeCompare(b.group_name ?? "zzz");
      if (sort === "group_desc")
        return (b.group_name ?? "zzz").localeCompare(a.group_name ?? "zzz");
      return 0;
    });

    return result;
  }, [matches, search, groupFilter, sort, predFilter, statusFilter, savedMatchIds]);

  // Sin filtros: agrupar por ronda. Con filtros: lista plana.
  // En "Terminados" se invierte el orden de rondas (la más avanzada primero) para
  // que los partidos eliminatorios ya jugados queden arriba y no enterrados tras
  // decenas de partidos de fase de grupos.
  const sections = useMemo(() => {
    if (anyFilter) {
      return [{ label: null as string | null, matches: filtered }];
    }
    const order = statusFilter === "finished" ? [...ROUNDS].reverse() : ROUNDS;
    return order
      .map((round) => ({
        label: ROUND_LABELS[round],
        matches: filtered.filter((m) => m.round === round),
      }))
      .filter((s) => s.matches.length > 0);
  }, [filtered, anyFilter, statusFilter]);

  return (
    <div className="flex flex-col gap-6">
      {/* Barra de filtros */}
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <input
          type="search"
          placeholder="Buscar por país…"
          aria-label="Buscar partido por país"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 outline-none focus:border-emerald-600"
        />

        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Ordenar"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-emerald-600"
          >
            <option value="kickoff_asc">↑ Más pronto</option>
            <option value="kickoff_desc">↓ Más tarde</option>
            <option value="group_asc">Grupo A→Z</option>
            <option value="group_desc">Grupo Z→A</option>
          </select>

          {groups.length > 0 && (
            <select
              aria-label="Filtrar por grupo"
              value={groupFilter ?? ""}
              onChange={(e) => setGroupFilter(e.target.value || null)}
              className="cursor-pointer rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-300 outline-none focus:border-emerald-600"
            >
              <option value="">Todos los grupos</option>
              {groups.map((g) => (
                <option key={g} value={g}>{displayGroup(g)}</option>
              ))}
            </select>
          )}

          <div className="flex items-center rounded-lg border border-neutral-700 overflow-hidden text-xs">
            {(
              [
                ["all", "Todos"],
                ["pending", "Pendientes"],
                ["finished", "Terminados"],
              ] as [StatusFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={statusFilter === key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 transition ${
                  statusFilter === key
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-neutral-400 hover:bg-neutral-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-lg border border-neutral-700 overflow-hidden text-xs">
            {(
              [
                ["all", "Todos"],
                ["with", "Con predicción"],
                ["without", "Sin predicción"],
              ] as [PredFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={predFilter === key}
                onClick={() => setPredFilter(key)}
                className={`px-3 py-1.5 transition ${
                  predFilter === key
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-neutral-400 hover:bg-neutral-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Partidos */}
      {sections.map((section, si) => (
        <section key={si} className="flex flex-col gap-4">
          {section.label && (
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {section.label}
            </h2>
          )}

          {section.matches.length === 0 && (
            <p className="text-sm text-neutral-500">No hay partidos que coincidan.</p>
          )}

          <div className="flex flex-col gap-4">
            {section.matches.map((match) => {
              const locked = isPredictionLocked(match.kickoff_at);
              const started = match.status === "live" || hasMatchStarted(match.kickoff_at);
              const knockout = isKnockoutRound(match.round);
              const mine = myPredByMatch.get(match.id);
              const others = othersByMatch.get(match.id) ?? [];
              const finished = match.status === "finished";
              const myPoints = pointsByMatch[match.id];
              const hasResult = match.home_score !== null;
              const scored = finished || (match.status === "live" && hasResult);
              // En vivo, el clasificado provisional es el que va ganando (en KO),
              // para proyectar los puntos. Terminado: el winner real.
              const effectiveWinner: MatchWinner | null =
                match.status === "live"
                  ? liveKnockoutWinner(match.round, match.home_score ?? 0, match.away_score ?? 0)
                  : (match.winner as MatchWinner | null);
              // El scoring de KO usa el marcador a 90' (sin alargue). reg cae al
              // de cancha en grupos o si no se capturó a 90'.
              const reg = regulationScore(match);
              const calcScore = (pred: PredData | null | undefined): MatchScore | null =>
                scored && pred
                  ? calculateMatchScore(
                      { round: match.round, home_score: reg.home, away_score: reg.away, winner: effectiveWinner },
                      { predicted_home: pred.predicted_home, predicted_away: pred.predicted_away, predicted_winner: pred.predicted_winner as MatchWinner | null },
                    )
                  : null;
              const myScore = calcScore(mine);
              const playerRows: Array<{ userId: string; isMe: boolean; pred: PredData | null; score: MatchScore | null }> = [
                { userId: uid, isMe: true, pred: mine ?? null, score: myScore },
                ...others.map((p) => ({ userId: p.user_id, isMe: false, pred: p, score: calcScore(p) })),
              ];
              if (scored) {
                playerRows.sort((a, b) => {
                  const pa = a.score?.points ?? (a.pred ? 0 : -1);
                  const pb = b.score?.points ?? (b.pred ? 0 : -1);
                  return pb - pa;
                });
              }

              // Filas de jugadores en columnas alineadas: nombre | resultado | ·
              // | país | · | puntos. Las columnas "·" son separadores. El ancho
              // del país lo fija el nombre más largo REALMENTE elegido por los
              // jugadores (no el del equipo más largo si nadie lo eligió).
              const chosenWinnerNames = knockout
                ? playerRows
                    .map((r) =>
                      r.pred?.predicted_winner === "home"
                        ? toSpanish(match.home_team)
                        : r.pred?.predicted_winner === "away"
                          ? toSpanish(match.away_team)
                          : "",
                    )
                    .filter(Boolean)
                : [];
              const hasCountry = chosenWinnerNames.length > 0;
              // Distintos países elegidos. Se renderizan invisibles y APILADOS en
              // cada celda (mismo grid-cell) para que la columna mida el ANCHO REAL
              // en píxeles del más ancho — no el de más caracteres (ej. "Japón",
              // 5 letras, mide más que "Brasil", 6). Igual en todas las filas → el
              // resultado queda alineado y el país nunca se trunca.
              const chosenPaisSet = hasCountry ? [...new Set(chosenWinnerNames)] : [];
              // Nombre: minmax(0,1fr) → ocupa el espacio sobrante y empuja
              // resultado/país/puntos hacia la derecha (alineados al borde, como
              // en desktop); en mobile el nombre se encoge/trunca para que no se
              // salgan los demás. Un solo "·" (min-content) entre marcador y país.
              // La columna país es max-content (del spacer) → pegada al punto y a
              // los puntos. El gap chico de la fila deja muy poco aire.
              const rowCols = [
                "minmax(0,1fr)",
                "3.25rem",
                hasCountry ? "min-content" : null,
                hasCountry ? "max-content" : null,
                scored ? "4.75rem" : null,
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <Card key={match.id} id={`m-${match.id}`} className="scroll-mt-20 p-4">
                  <div className="mb-3 flex items-start justify-between gap-2 text-xs text-neutral-500">
                    <div className="min-w-0">
                      <div className="truncate">
                        {match.group_name ? (
                          <button
                            type="button"
                            onClick={() => setGroupFilter(match.group_name)}
                            className="rounded text-left hover:text-emerald-400 hover:underline"
                          >
                            {displayGroup(match.group_name)}
                          </button>
                        ) : (
                          <Link
                            href={`/pool/${poolId}/bracket`}
                            className="rounded hover:text-emerald-400 hover:underline"
                          >
                            {ROUND_LABELS[match.round]}
                          </Link>
                        )}
                      </div>
                      <div className="text-neutral-600">
                        {DATE_FMT.format(new Date(match.kickoff_at))}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {finished ? (
                        <span className="font-medium text-neutral-300">Final</span>
                      ) : match.status === "live" ? (
                        <span className="inline-flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                            <span className="font-medium text-red-400">EN VIVO</span>
                          </span>
                          {liveProgressLabel(match.live_minute, match.kickoff_at) && (
                            <span className="text-neutral-400">
                              {liveProgressLabel(match.live_minute, match.kickoff_at)}
                            </span>
                          )}
                        </span>
                      ) : started ? (
                        <span>Empezó</span>
                      ) : locked ? (
                        <span className="text-neutral-500">Cerrado</span>
                      ) : (
                        <LockCountdown kickoffAt={match.kickoff_at} />
                      )}
                    </div>
                  </div>

                  {!locked ? (
                    <PredictionForm
                      matchId={match.id}
                      homeTeam={toSpanish(match.home_team)}
                      awayTeam={toSpanish(match.away_team)}
                      isKnockout={knockout}
                      initialHome={localPreds.get(match.id)?.home ?? mine?.predicted_home ?? null}
                      initialAway={localPreds.get(match.id)?.away ?? mine?.predicted_away ?? null}
                      initialWinner={
                        ((localPreds.get(match.id)?.winner ?? mine?.predicted_winner) as MatchWinner | null) ?? null
                      }
                      onSaved={(id, home, away, winner) => {
                        setSavedMatchIds((prev) => new Set([...prev, id]));
                        setLocalPreds((prev) => new Map(prev).set(id, { home, away, winner }));
                      }}
                      homeTeamEl={<TeamName team={match.home_team} className="text-sm font-medium sm:truncate sm:text-base" />}
                      awayTeamEl={<TeamName team={match.away_team} className="text-sm font-medium sm:truncate sm:text-base" />}
                    />
                  ) : (
                    <div className="flex flex-col gap-4">
                      {/* Partido centrado */}
                      <div className="flex flex-col items-center gap-3">
                        {/* Nombres en mobile (fila separada): no hay espacio con el marcador inline */}
                        <div className="flex w-full items-center justify-between font-semibold sm:hidden">
                          <span className="flex items-center gap-1.5">
                            <Flag team={match.home_team} className="shrink-0" />
                            <TeamName team={match.home_team} className="truncate" />
                          </span>
                          <span className="flex items-center gap-1.5">
                            <TeamName team={match.away_team} className="truncate" />
                            <Flag team={match.away_team} className="shrink-0" />
                          </span>
                        </div>
                        <div className="flex justify-center sm:grid sm:w-full sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-x-3">
                          <div className="hidden min-w-0 items-center justify-end gap-2 sm:flex">
                            <TeamName team={match.home_team} className="min-w-0 truncate text-right text-base font-semibold leading-tight" />
                            <Flag team={match.home_team} className="shrink-0" />
                          </div>
                          <div className="flex flex-col items-center px-2">
                            {match.status === "live" || match.home_score !== null ? (
                              <span className="whitespace-nowrap text-2xl font-bold tabular-nums text-neutral-100">
                                {match.home_score ?? 0} – {match.away_score ?? 0}
                              </span>
                            ) : (
                              <span className="text-base font-medium text-neutral-600">vs</span>
                            )}
                            {match.home_pen !== null && match.away_pen !== null && (
                              <span className="whitespace-nowrap text-[11px] font-medium text-neutral-400">
                                ({match.home_pen}-{match.away_pen} pen.)
                              </span>
                            )}
                          </div>
                          <div className="hidden min-w-0 items-center gap-2 sm:flex">
                            <Flag team={match.away_team} className="shrink-0" />
                            <TeamName team={match.away_team} className="min-w-0 truncate text-base font-semibold leading-tight" />
                          </div>
                        </div>
                        {myScore ? (
                          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                            {REASON_LABELS[myScore.reason]} · +{myPoints ?? myScore.points} puntos
                          </span>
                        ) : (scored && mine) ? (
                          <span className="rounded bg-neutral-500/15 px-2 py-0.5 text-xs font-medium text-neutral-500">
                            0 puntos
                          </span>
                        ) : null}
                      </div>

                      <hr className="border-neutral-900" />

                      <ul className="flex flex-col gap-1 text-sm">
                        {playerRows.map(({ userId, isMe, pred, score }) => (
                          <li
                            key={userId}
                            style={{ gridTemplateColumns: rowCols }}
                            className={`-mx-2 grid items-center gap-x-0.5 rounded px-2 py-0.5 transition-colors hover:bg-neutral-800/50 ${isMe ? "text-neutral-300" : "text-neutral-400"}`}
                          >
                            <div className="flex min-w-0 items-center">
                              <Link
                                href={`/pool/${poolId}/player/${userId}`}
                                className="truncate hover:text-emerald-400 hover:underline"
                              >
                                {nameById[userId] ?? "?"}
                              </Link>
                              {isMe && (
                                <span className="ml-1.5 shrink-0 text-xs text-emerald-400">(tú)</span>
                              )}
                            </div>

                            {pred ? (
                              <>
                                {/* Resultado: alineado a la derecha para que el
                                    marcador quede pegado al · (si va centrado, el
                                    padding de la columna agranda el hueco izq.) */}
                                <span className="text-right tabular-nums">
                                  {pred.predicted_home ?? "–"}
                                  <span className="px-1 text-neutral-500">–</span>
                                  {pred.predicted_away ?? "–"}
                                </span>
                                {/* País clasificado: separador · + nombre (solo KO).
                                    Los spacers invisibles (todos los países elegidos,
                                    apilados en el mismo grid-cell) fijan el ancho real
                                    de la columna; el nombre real va encima. */}
                                {hasCountry && (
                                  <>
                                    <span className="text-center text-neutral-600">·</span>
                                    {/* mr-1.5 = gap país↔puntos (subí/bajá este valor). */}
                                    <span className="relative mr-1.5 grid text-neutral-400">
                                      {chosenPaisSet.map((p) => (
                                        <span
                                          key={p}
                                          aria-hidden
                                          className="invisible col-start-1 row-start-1 whitespace-nowrap"
                                        >
                                          {p}
                                        </span>
                                      ))}
                                      <span className="col-start-1 row-start-1 truncate text-left">
                                        {pred.predicted_winner === "home"
                                          ? toSpanish(match.home_team)
                                          : pred.predicted_winner === "away"
                                            ? toSpanish(match.away_team)
                                            : ""}
                                      </span>
                                    </span>
                                  </>
                                )}
                                {/* Puntos: badge pegado al país (sin separador ·) */}
                                {scored &&
                                  (score ? (
                                    <span className="inline-flex min-w-[4.75rem] justify-center justify-self-center rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-400">
                                      +{isMe ? (myPoints ?? score.points) : score.points} puntos
                                    </span>
                                  ) : (
                                    <span className="inline-flex min-w-[4.75rem] justify-center justify-self-center rounded bg-neutral-500/15 px-1.5 py-0.5 text-xs font-medium text-neutral-500">
                                      0 puntos
                                    </span>
                                  ))}
                              </>
                            ) : (
                              <>
                                <span
                                  className="text-neutral-500"
                                  style={{ gridColumn: scored ? "2 / -2" : "2 / -1" }}
                                >
                                  sin predicción
                                </span>
                                {scored && <span />}
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
