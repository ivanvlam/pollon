"use client";

import { useMemo, useState } from "react";

import { Flag } from "@/components/Flag";
import { LockCountdown } from "@/components/LockCountdown";
import { PredictionForm } from "@/components/PredictionForm";
import { Card } from "@/components/ui/Card";
import { isKnockoutRound, ROUNDS, type Round } from "@/lib/constants";
import { toSpanish } from "@/lib/teamNames";
import { isPredictionLocked } from "@/lib/timing";
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

const ROUND_LABELS: Record<Round, string> = {
  group_stage: "Fase de grupos",
  round_of_32: "Dieciseisavos de final",
  round_of_16: "Octavos de final",
  quarterfinal: "Cuartos de final",
  semifinal: "Semifinales",
  final: "Final",
};

const fmt = (h: number | null, a: number | null) =>
  h === null || a === null ? "-" : `${h}-${a}`;

// TheSportsDB devuelve "Group A", la app está en español → "Grupo A"
const displayGroup = (name: string) => name.replace(/^Group\s+/i, "Grupo ");

const chip = (active: boolean) =>
  `rounded-full border px-3 py-1 text-xs transition cursor-pointer ${
    active
      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
      : "border-neutral-700 text-neutral-400 hover:bg-neutral-800"
  }`;

export function PredictionsClient({
  poolId: _poolId,
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
  }, [matches, search, groupFilter, sort, predFilter, savedMatchIds]);

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

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">Ordenar:</span>
          {(
            [
              ["kickoff_asc", "Más pronto"],
              ["kickoff_desc", "Más tarde"],
              ["group_asc", "Grupo A→Z"],
              ["group_desc", "Grupo Z→A"],
            ] as [SortKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={sort === key}
              className={chip(sort === key)}
              onClick={() => setSort(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">Predicción:</span>
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
              className={chip(predFilter === key)}
              onClick={() => setPredFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {groups.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={groupFilter === null}
              className={chip(groupFilter === null)}
              onClick={() => setGroupFilter(null)}
            >
              Todos los grupos
            </button>
            {groups.map((g) => (
              <button
                key={g}
                type="button"
                aria-pressed={groupFilter === g}
                className={chip(groupFilter === g)}
                onClick={() => setGroupFilter(groupFilter === g ? null : g)}
              >
                {displayGroup(g)}
              </button>
            ))}
          </div>
        )}
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
              const knockout = isKnockoutRound(match.round);
              const mine = myPredByMatch.get(match.id);
              const others = othersByMatch.get(match.id) ?? [];
              const finished = match.status === "finished";
              const myPoints = pointsByMatch[match.id];

              return (
                <Card key={match.id} id={`m-${match.id}`} className="scroll-mt-20 p-4">
                  <div className="mb-3 flex items-center justify-between text-xs text-neutral-500">
                    <span>{match.group_name ? displayGroup(match.group_name) : ROUND_LABELS[match.round]}</span>
                    <span>
                      {new Date(match.kickoff_at).toLocaleString()}
                      {" · "}
                      {finished ? (
                        <span className="font-medium text-neutral-300">
                          Final {fmt(match.home_score, match.away_score)}
                        </span>
                      ) : locked ? (
                        <span>Empezó</span>
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
                    />
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          <Flag team={match.home_team} />
                          {toSpanish(match.home_team)}
                          <span className="text-neutral-500">vs</span>
                          {toSpanish(match.away_team)}
                          <Flag team={match.away_team} />
                        </span>
                        {myPoints !== undefined && (
                          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                            +{myPoints} pts
                          </span>
                        )}
                      </div>

                      <ul className="flex flex-col gap-1 text-sm">
                        <li className="flex justify-between text-neutral-300">
                          <span>Tú</span>
                          <span>
                            {mine
                              ? `${fmt(mine.predicted_home, mine.predicted_away)}${
                                  mine.predicted_winner
                                    ? ` · ${mine.predicted_winner === "home" ? toSpanish(match.home_team) : toSpanish(match.away_team)}`
                                    : ""
                                }`
                              : "sin predicción"}
                          </span>
                        </li>
                        {others.map((p) => (
                          <li
                            key={p.user_id}
                            className="flex justify-between text-neutral-400"
                          >
                            <span>{nameById[p.user_id] ?? "?"}</span>
                            <span>
                              {fmt(p.predicted_home, p.predicted_away)}
                              {p.predicted_winner
                                ? ` · ${p.predicted_winner === "home" ? toSpanish(match.home_team) : toSpanish(match.away_team)}`
                                : ""}
                            </span>
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
