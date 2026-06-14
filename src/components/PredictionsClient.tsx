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
import { formatLiveMinute } from "@/lib/liveMinute";
import { calculateMatchScore, type MatchScore } from "@/lib/scoring";
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

const fmt = (h: number | null, a: number | null) =>
  h === null || a === null ? "-" : `${h}-${a}`;

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
  const sections = useMemo(() => {
    if (anyFilter) {
      return [{ label: null as string | null, matches: filtered }];
    }
    return ROUNDS.map((round) => ({
      label: ROUND_LABELS[round],
      matches: filtered.filter((m) => m.round === round),
    })).filter((s) => s.matches.length > 0);
  }, [filtered, anyFilter]);

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
              const calcScore = (pred: PredData | null | undefined): MatchScore | null =>
                scored && pred
                  ? calculateMatchScore(
                      { round: match.round, home_score: match.home_score, away_score: match.away_score, winner: match.winner as MatchWinner | null },
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

              return (
                <Card key={match.id} id={`m-${match.id}`} className="scroll-mt-20 p-4">
                  <div className="mb-3 flex items-center justify-between text-xs text-neutral-500">
                    <span>{match.group_name ? displayGroup(match.group_name) : ROUND_LABELS[match.round]}</span>
                    <span>
                      {DATE_FMT.format(new Date(match.kickoff_at))}
                      {" · "}
                      {finished ? (
                        <span className="font-medium text-neutral-300">
                          Final {fmt(match.home_score, match.away_score)}
                        </span>
                      ) : match.status === "live" ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                          <span className="font-medium text-red-400">EN VIVO</span>
                          <span className="text-neutral-200">
                            {match.home_score ?? 0}-{match.away_score ?? 0}
                          </span>
                          {formatLiveMinute(match.live_minute) && (
                            <span className="text-neutral-400">
                              {formatLiveMinute(match.live_minute)}
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
                    </span>
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
                      homeTeamEl={<TeamName team={match.home_team} className="truncate text-sm font-medium sm:text-base" />}
                      awayTeamEl={<TeamName team={match.away_team} className="truncate text-sm font-medium sm:text-base" />}
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
                          <div className="hidden items-center justify-end gap-2 sm:flex">
                            <TeamName team={match.home_team} className="text-right text-base font-semibold leading-tight" />
                            <Flag team={match.home_team} />
                          </div>
                          <div className="flex flex-col items-center px-2">
                            <span className="whitespace-nowrap text-2xl font-bold tabular-nums text-neutral-100">
                              {match.status === "live" || match.home_score !== null
                                ? `${match.home_score ?? 0} – ${match.away_score ?? 0}`
                                : "–"}
                            </span>
                          </div>
                          <div className="hidden items-center gap-2 sm:flex">
                            <Flag team={match.away_team} />
                            <TeamName team={match.away_team} className="text-base font-semibold leading-tight" />
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
                            className={`flex items-center justify-between gap-2 ${isMe ? "text-neutral-300" : "text-neutral-400"}`}
                          >
                            <Link
                              href={`/pool/${poolId}/player/${userId}`}
                              className="truncate hover:text-emerald-400 hover:underline"
                            >
                              {isMe ? "Tú" : (nameById[userId] ?? "?")}
                            </Link>
                            <div className="flex items-center gap-2">
                              {pred ? (
                                <span className="flex items-center gap-0.5 tabular-nums">
                                  <span className="inline-block w-5 text-right">{pred.predicted_home ?? "–"}</span>
                                  <span className="px-0.5">–</span>
                                  <span className="inline-block w-5">{pred.predicted_away ?? "–"}</span>
                                  {pred.predicted_winner && (
                                    <span className="ml-1">
                                      · {pred.predicted_winner === "home" ? toSpanish(match.home_team) : toSpanish(match.away_team)}
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span>sin predicción</span>
                              )}
                              {scored && pred && (
                                score ? (
                                  <span className="inline-flex justify-center rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-400 min-w-[5rem]">
                                    +{isMe ? (myPoints ?? score.points) : score.points} puntos
                                  </span>
                                ) : (
                                  <span className="inline-flex justify-center rounded bg-neutral-500/15 px-1.5 py-0.5 text-xs font-medium text-neutral-500 min-w-[5rem]">
                                    0 puntos
                                  </span>
                                )
                              )}
                            </div>
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
