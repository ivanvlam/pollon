import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Flag } from "@/components/Flag";
import type { GroupMatchRow } from "@/components/GroupCard";
import { BracketGroupLabel, type GroupModalData } from "@/components/BracketGroupLabel";
import { TeamName } from "@/components/TeamName";
import { toSpanish } from "@/lib/teamNames";
import { createClient } from "@/lib/supabase/server";
import {
  computeGroupClinch,
  computeGroupPositionLock,
  computeGroupStandings,
  type GroupClinch,
  type GroupMatch,
  type StandingRow,
} from "@/lib/standings";
import type { MatchWinner, Round } from "@/types";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: pool } = await supabase.from("pools").select("name").eq("id", params.id).maybeSingle();
  return { title: pool ? `Bracket · ${pool.name}` : "Bracket" };
}

// ─── Geometry ─────────────────────────────────────────────────────────────────
const SLOT_H   = 96;
const TOTAL_H  = 16 * SLOT_H;
const CARD_W   = 264;
const STUB_W   = 20;
const CONN_W   = 48;
const LINE     = "#606060";
const HEADER_H = 40;

const ALL_N      = [16, 8, 4, 2, 1];
const ALL_LABELS = ["Dieciseisavos", "Octavos", "Cuartos", "Semis", "Final"];

const colX       = (si: number) => si * (CARD_W + CONN_W);
const stageSlotH = (si: number) => TOTAL_H / ALL_N[si]!;
const midY       = (si: number, i: number) => HEADER_H + (i + 0.5) * stageSlotH(si);
const totalW     = colX(ALL_N.length - 1) + CARD_W;

// ─── R32 hardcoded bracket structure ─────────────────────────────────────────
type GroupPos  = { type: "winner" | "runner_up"; group: string };
type BestThird = { type: "best_third"; from: string[] };
type SlotDef   = GroupPos | BestThird;

interface R32Def { matchNum: number; home: SlotDef; away: SlotDef }

const R32_DEFS: R32Def[] = [
  // ── Section → QF1 ────────────────────────────────────────────────────────
  { matchNum: 74, home: { type: "winner",    group: "E" }, away: { type: "best_third", from: ["A","B","C","D","F"] } },
  { matchNum: 77, home: { type: "winner",    group: "I" }, away: { type: "best_third", from: ["C","D","F","G","H"] } },
  { matchNum: 73, home: { type: "runner_up", group: "A" }, away: { type: "runner_up", group: "B" } },
  { matchNum: 75, home: { type: "winner",    group: "F" }, away: { type: "runner_up", group: "C" } },
  // ── Section → QF2 ────────────────────────────────────────────────────────
  { matchNum: 83, home: { type: "runner_up", group: "K" }, away: { type: "runner_up", group: "L" } },
  { matchNum: 84, home: { type: "winner",    group: "H" }, away: { type: "runner_up", group: "J" } },
  { matchNum: 81, home: { type: "winner",    group: "D" }, away: { type: "best_third", from: ["B","E","F","I","J"] } },
  { matchNum: 82, home: { type: "winner",    group: "G" }, away: { type: "best_third", from: ["A","E","H","I","J"] } },
  // ── Section → QF3 ────────────────────────────────────────────────────────
  { matchNum: 76, home: { type: "winner",    group: "C" }, away: { type: "runner_up", group: "F" } },
  { matchNum: 78, home: { type: "runner_up", group: "E" }, away: { type: "runner_up", group: "I" } },
  { matchNum: 79, home: { type: "winner",    group: "A" }, away: { type: "best_third", from: ["C","E","F","H","I"] } },
  { matchNum: 80, home: { type: "winner",    group: "L" }, away: { type: "best_third", from: ["E","H","I","J","K"] } },
  // ── Section → QF4 ────────────────────────────────────────────────────────
  { matchNum: 86, home: { type: "winner",    group: "J" }, away: { type: "runner_up", group: "H" } },
  { matchNum: 88, home: { type: "runner_up", group: "D" }, away: { type: "runner_up", group: "G" } },
  { matchNum: 85, home: { type: "winner",    group: "B" }, away: { type: "best_third", from: ["E","F","G","I","J"] } },
  { matchNum: 87, home: { type: "winner",    group: "K" }, away: { type: "best_third", from: ["D","E","I","J","L"] } },
];

const LATER_ROUNDS: { round: Round; n: number; firstMatchNum: number }[] = [
  { round: "round_of_16",  n: 8, firstMatchNum: 89  },
  { round: "quarterfinal", n: 4, firstMatchNum: 97  },
  { round: "semifinal",    n: 2, firstMatchNum: 101 },
  { round: "final",        n: 1, firstMatchNum: 104 },
];

// Returns [homeFeeder, awayFeeder] match numbers for PlaceholderCard
function getFeeder(si: number, i: number): [number, number] {
  if (si === 0) return [R32_DEFS[2 * i]!.matchNum, R32_DEFS[2 * i + 1]!.matchNum];
  if (si === 1) return [89 + 2 * i, 89 + 2 * i + 1];
  if (si === 2) return [97 + 2 * i, 97 + 2 * i + 1];
  return [101, 102];
}


// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function BracketPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user!.id;

  const [{ data: pool }, { data: groupMatches }, { data: allKnockout }, { data: viewerProfile }] =
    await Promise.all([
      supabase.from("pools").select("id, name").eq("id", params.id).maybeSingle(),
      supabase.from("matches")
        .select("id, group_name, home_team, away_team, kickoff_at, home_score, away_score, status, is_active, live_minute")
        .eq("round", "group_stage"),
      supabase.from("matches")
        .select("id, round, home_team, away_team, kickoff_at, status, home_score, away_score, winner")
        .in("round", ["round_of_32", ...LATER_ROUNDS.map(r => r.round)])
        .order("kickoff_at", { ascending: true }),
      supabase.from("profiles").select("timezone").eq("id", uid).maybeSingle(),
    ]);

  if (!pool) notFound();

  const tz = viewerProfile?.timezone ?? "UTC";
  const dateFmt = new Intl.DateTimeFormat("es", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz,
  });

  // ── Group standings ──────────────────────────────────────────────────────
  const groupsMap = new Map<string, NonNullable<typeof groupMatches>[number][]>();
  for (const m of groupMatches ?? []) {
    const key = (m.group_name ?? "?").replace(/^Group\s+/i, "");
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key)!.push(m);
  }

  // ── Predicciones y puntos del usuario para partidos de grupo (para el modal) ─
  const groupMatchIds = (groupMatches ?? []).map((m) => m.id);
  const [{ data: groupPreds }, { data: groupScores }] = await Promise.all([
    supabase.from("predictions")
      .select("match_id, predicted_home, predicted_away")
      .eq("user_id", uid)
      .in("match_id", groupMatchIds.length > 0 ? groupMatchIds : ["__none__"]),
    supabase.from("scores")
      .select("match_id, points")
      .eq("pool_id", params.id)
      .eq("user_id", uid),
  ]);
  const predByGroupMatch = new Map((groupPreds ?? []).map((p) => [p.match_id, p]));
  const pointsByGroupMatch = new Map(
    (groupScores ?? []).filter((s) => s.match_id !== null).map((s) => [s.match_id as string, s.points]),
  );

  const groupLeaders: Record<string, { winner: string | null; runnerUp: string | null }> = {};
  const clinchMap = new Map<string, Map<string, GroupClinch>>();
  const positionLockMap = new Map<string, Set<string>>();
  const groupModalDataMap = new Map<string, GroupModalData>();
  const groupThirds: StandingRow[] = [];
  for (const [g, ms] of groupsMap) {
    const standings = computeGroupStandings(ms);
    groupLeaders[g] = { winner: standings[0]?.team ?? null, runnerUp: standings[1]?.team ?? null };
    const clinch = computeGroupClinch(ms as GroupMatch[]);
    clinchMap.set(g, clinch);
    positionLockMap.set(g, computeGroupPositionLock(ms as GroupMatch[]));
    if (standings[2]) groupThirds.push(standings[2]);
    const modalMatches: GroupMatchRow[] = ms.map((m) => ({
      id: m.id,
      home_team: m.home_team,
      away_team: m.away_team,
      kickoff_at: m.kickoff_at,
      status: m.status,
      home_score: m.home_score,
      away_score: m.away_score,
      live_minute: m.live_minute,
      is_active: m.is_active,
      pred: predByGroupMatch.get(m.id) ?? null,
      myPoints: pointsByGroupMatch.get(m.id),
    }));
    groupModalDataMap.set(g, { groupName: `Grupo ${g}`, standings, matches: modalMatches, clinch });
  }

  // Los 8 mejores terceros clasifican: mismo cálculo que la pestaña de grupos,
  // para colorear en amarillo al 3° que va clasificando dentro del modal.
  groupThirds.sort((a, b) => b.points - a.points || b.gd - a.gd || a.team.localeCompare(b.team));
  const qualifyingThirds = new Set(groupThirds.slice(0, 8).map((r) => r.team));
  for (const data of groupModalDataMap.values()) data.qualifyingThirds = qualifyingThirds;

  const resolveTeam = (s: SlotDef): string | null => {
    if (s.type === "best_third") return null;
    const g = groupLeaders[s.group];
    return s.type === "winner" ? (g?.winner ?? null) : (g?.runnerUp ?? null);
  };
  const slotLabel = (s: SlotDef): string => {
    if (s.type === "best_third") return `Mejor 3° (${s.from.join("/")})`;
    return s.type === "winner" ? `1° Grupo ${s.group}` : `2° Grupo ${s.group}`;
  };
  const getGroupData = (s: SlotDef): GroupModalData | null => {
    if (s.type === "best_third") return null;
    return groupModalDataMap.get(s.group) ?? null;
  };
  // Verde en el bracket SOLO si la posición exacta del equipo (1° o 2°) ya está
  // fijada: en el cuadro, 1° y 2° van a llaves distintas, así que un equipo
  // clasificado pero que todavía puede intercambiar 1°/2° no tiene su rama
  // definida y no debe pintarse verde.
  const isSlotQualified = (s: SlotDef): boolean => {
    if (s.type === "best_third") return false;
    const team = resolveTeam(s);
    if (!team) return false;
    return positionLockMap.get(s.group)?.has(team) ?? false;
  };

  // ── R32 matches from DB (for date/time) ──────────────────────────────────
  const r32Matches = (allKnockout ?? [])
    .filter(m => m.round === "round_of_32")
    .sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));

  // ── Later round matches by round ─────────────────────────────────────────
  type KoMatch = NonNullable<typeof allKnockout>[number];
  const byRound = new Map<Round, KoMatch[]>();
  for (const r of LATER_ROUNDS) byRound.set(r.round, []);
  for (const m of allKnockout ?? []) {
    if (m.round !== "round_of_32") byRound.get(m.round as Round)?.push(m);
  }

  // ── My predictions (later rounds only) ───────────────────────────────────
  const laterIds = (allKnockout ?? []).filter(m => m.round !== "round_of_32").map(m => m.id);
  const { data: preds } = laterIds.length > 0
    ? await supabase.from("predictions")
        .select("match_id, predicted_home, predicted_away, predicted_winner")
        .eq("user_id", uid).in("match_id", laterIds)
    : { data: [] };
  const predBy = new Map((preds ?? []).map(p => [p.match_id, p]));

  const sh0 = stageSlotH(0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bracket</h1>
        <Link href={`/pool/${params.id}`} className="text-sm text-neutral-400 hover:text-white">
          ← Volver al ranking
        </Link>
      </header>

      <p className="text-xs text-neutral-500">
        <span className="font-semibold text-emerald-400">Verde</span> = clasificado a
        la siguiente ronda.
      </p>

      {/* ── Mobile view ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-8 md:hidden">
        {/* Dieciseisavos */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400 border-b border-neutral-800 pb-2">
            Dieciseisavos
          </h2>
          <div className="flex flex-col gap-3">
            {R32_DEFS.map((def, i) => {
              const dbM = r32Matches[i] ?? null;
              const date = dbM ? dateFmt.format(new Date(dbM.kickoff_at)) : null;
              return (
                <R32Card
                  key={i}
                  matchNum={def.matchNum}
                  date={date}
                  homeTeam={resolveTeam(def.home)}
                  homeLabel={slotLabel(def.home)}
                  homeGroupData={getGroupData(def.home)}
                  homeQualified={isSlotQualified(def.home)}
                  awayTeam={resolveTeam(def.away)}
                  awayLabel={slotLabel(def.away)}
                  awayGroupData={getGroupData(def.away)}
                  awayQualified={isSlotQualified(def.away)}
                />
              );
            })}
          </div>
        </section>

        {/* Later rounds */}
        {LATER_ROUNDS.map((stage, si) => {
          const stageIdx = si + 1;
          const matches  = byRound.get(stage.round) ?? [];
          return (
            <section key={stage.round}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400 border-b border-neutral-800 pb-2">
                {ALL_LABELS[stageIdx]}
              </h2>
              <div className="flex flex-col gap-2">
                {Array.from({ length: stage.n }, (_, i) => {
                  const match    = matches[i] ?? null;
                  const matchNum = stage.firstMatchNum + i;
                  if (match) {
                    return (
                      <RealCard
                        key={i}
                        match={match}
                        matchNum={matchNum}
                        pred={predBy.get(match.id) ?? null}
                        poolId={params.id}
                        dateFmt={dateFmt}
                      />
                    );
                  }
                  const [hf, af] = getFeeder(si, i);
                  return (
                    <PlaceholderCard key={i} matchNum={matchNum} homeFeeder={hf} awayFeeder={af} />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* ── Desktop bracket ─────────────────────────────────────────────── */}
      <p className="hidden text-center text-xs text-neutral-600 md:block">
        Desliza horizontalmente para ver todas las rondas.
      </p>

      <div className="hidden overflow-x-auto pb-6 md:block">
        <div style={{ position: "relative", width: totalW, height: TOTAL_H + HEADER_H }}>

          {/* ── Column headers ──────────────────────────────────────────── */}
          {ALL_LABELS.map((label, si) => (
            <div
              key={si}
              style={{
                position: "absolute", left: colX(si), top: 0,
                width: CARD_W, height: HEADER_H,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderBottom: "1px solid #262626",
                background: "#0d0d0d",
              }}
              className="text-xs font-semibold uppercase tracking-wide text-neutral-300"
            >
              {label}
            </div>
          ))}

          {/* ── R32 slots ───────────────────────────────────────────────── */}
          {R32_DEFS.map((def, i) => {
            const dbM  = r32Matches[i] ?? null;
            const date = dbM ? dateFmt.format(new Date(dbM.kickoff_at)) : null;
            return (
              <div
                key={i}
                style={{
                  position: "absolute", left: colX(0), top: HEADER_H + i * sh0,
                  width: CARD_W, height: sh0,
                  display: "flex", alignItems: "center", padding: "4px 0",
                }}
              >
                <R32Card
                  matchNum={def.matchNum}
                  date={date}
                  homeTeam={resolveTeam(def.home)}
                  homeLabel={slotLabel(def.home)}
                  homeGroupData={getGroupData(def.home)}
                  homeQualified={isSlotQualified(def.home)}
                  awayTeam={resolveTeam(def.away)}
                  awayLabel={slotLabel(def.away)}
                  awayGroupData={getGroupData(def.away)}
                  awayQualified={isSlotQualified(def.away)}
                />
              </div>
            );
          })}

          {/* ── Section separators (between QF groups in R32) ───────────── */}
          {[4, 8, 12].map((slotIdx) => (
            <div
              key={`sep-${slotIdx}`}
              style={{
                position: "absolute",
                left: colX(0),
                top: HEADER_H + slotIdx * sh0,
                width: CARD_W,
                height: 0,
                borderTop: "1px dashed #2a2a2a",
              }}
            />
          ))}

          {/* ── Later rounds ────────────────────────────────────────────── */}
          {LATER_ROUNDS.map((stage, si) => {
            const stageIdx = si + 1;
            const sh       = stageSlotH(stageIdx);
            const matches  = byRound.get(stage.round) ?? [];
            return (
              <React.Fragment key={stage.round}>
                {Array.from({ length: stage.n }, (_, i) => {
                  const match    = matches[i] ?? null;
                  const matchNum = stage.firstMatchNum + i;
                  const [hf, af] = getFeeder(si, i);
                  return (
                    <div
                      key={i}
                      style={{
                        position: "absolute", left: colX(stageIdx), top: HEADER_H + i * sh,
                        width: CARD_W, height: sh,
                        display: "flex", alignItems: "center", padding: "4px 0",
                      }}
                    >
                      {match ? (
                        <RealCard
                          match={match}
                          matchNum={matchNum}
                          pred={predBy.get(match.id) ?? null}
                          poolId={params.id}
                          dateFmt={dateFmt}
                        />
                      ) : (
                        <PlaceholderCard matchNum={matchNum} homeFeeder={hf} awayFeeder={af} />
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* ── Connectors ──────────────────────────────────────────────── */}
          {ALL_N.slice(0, -1).map((n, si) => {
            const x = colX(si) + CARD_W;
            return (
              <React.Fragment key={`conn-${si}`}>
                {Array.from({ length: n }, (_, i) => (
                  <div
                    key={`st-${i}`}
                    style={{ position: "absolute", left: x, top: midY(si, i) - 0.5,
                             width: STUB_W, height: 1, background: LINE }}
                  />
                ))}
                {Array.from({ length: n / 2 }, (_, i) => {
                  const tY = midY(si, 2 * i);
                  const bY = midY(si, 2 * i + 1);
                  return (
                    <React.Fragment key={`pr-${i}`}>
                      <div style={{ position: "absolute", left: x + STUB_W, top: tY,
                                   width: 1, height: bY - tY, background: LINE }} />
                      <div style={{ position: "absolute", left: x + STUB_W, top: (tY + bY) / 2 - 0.5,
                                   width: CONN_W - STUB_W, height: 1, background: LINE }} />
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}

        </div>
      </div>
    </div>
  );
}

// ─── R32 card ─────────────────────────────────────────────────────────────────
function R32Card({
  matchNum, date,
  homeTeam, homeLabel, homeGroupData, homeQualified,
  awayTeam, awayLabel, awayGroupData, awayQualified,
}: {
  matchNum: number; date: string | null;
  homeTeam: string | null; homeLabel: string; homeGroupData: GroupModalData | null; homeQualified: boolean;
  awayTeam: string | null; awayLabel: string; awayGroupData: GroupModalData | null; awayQualified: boolean;
}) {
  return (
    <div className="w-full rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-2 text-xs">
      <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-400">
        <span className="font-medium">Partido {matchNum}</span>
        {date && <span className="text-neutral-500">{date}</span>}
      </div>
      <SlotRow team={homeTeam} label={homeLabel} groupData={homeGroupData} qualified={homeQualified} />
      <div className="my-1 border-t border-neutral-800" />
      <SlotRow team={awayTeam} label={awayLabel} groupData={awayGroupData} qualified={awayQualified} />
    </div>
  );
}

function SlotRow({
  team, label, groupData, qualified,
}: {
  team: string | null;
  label: string;
  groupData: GroupModalData | null;
  qualified: boolean;
}) {
  const labelEl = groupData ? (
    <BracketGroupLabel label={label} {...groupData} />
  ) : label;

  // Clasificado a la siguiente ronda (top-2 asegurado) → verde.
  return team ? (
    <div className={`flex min-h-[20px] items-center gap-1 ${qualified ? "text-emerald-400" : "text-neutral-100"}`}>
      <Flag team={team} className="h-[13px] w-[18px] shrink-0" />
      <TeamName team={team} className="min-w-0 flex-1 truncate font-medium" />
      <span className="shrink-0 text-[10px] text-neutral-500">{labelEl}</span>
    </div>
  ) : (
    <div className="flex min-h-[20px] items-center text-xs text-neutral-500">{labelEl}</div>
  );
}

// ─── Real match card (R16+) ───────────────────────────────────────────────────
function RealCard({
  match, matchNum, pred, poolId, dateFmt,
}: {
  match: {
    id: string; home_team: string; away_team: string;
    status: string; kickoff_at: string;
    home_score: number | null; away_score: number | null; winner: string | null;
  };
  matchNum: number;
  pred: { predicted_home: number | null; predicted_away: number | null; predicted_winner: string | null } | null;
  poolId: string;
  dateFmt: Intl.DateTimeFormat;
}) {
  const finished = match.status === "finished";
  const homeVal  = finished ? match.home_score : (pred?.predicted_home ?? null);
  const awayVal  = finished ? match.away_score : (pred?.predicted_away ?? null);
  const winner: MatchWinner | null = finished
    ? (match.winner as MatchWinner | null)
    : ((pred?.predicted_winner as MatchWinner | null) ?? null);

  return (
    <Link
      href={`/pool/${poolId}/predictions#m-${match.id}`}
      className="block w-full rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-2 text-xs transition hover:border-neutral-700 hover:bg-neutral-800/60"
    >
      <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-400">
        <span className="font-medium">Partido {matchNum}</span>
        <span className="text-neutral-500">{dateFmt.format(new Date(match.kickoff_at))}</span>
      </div>
      <TeamRow team={match.home_team} value={homeVal} win={winner === "home"} />
      <div className="my-1 border-t border-neutral-800" />
      <TeamRow team={match.away_team} value={awayVal} win={winner === "away"} />
      <p className="mt-1 text-[10px] text-neutral-500">
        {finished ? "Resultado" : pred ? "Tu pronóstico" : "Sin pronóstico"}
      </p>
    </Link>
  );
}

function TeamRow({ team, value, win }: { team: string; value: number | null; win: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-1 ${win ? "font-semibold text-emerald-400" : "text-neutral-200"}`}>
      <span className="flex min-w-0 items-center gap-1">
        <Flag team={team} className="h-[13px] w-[18px] shrink-0" />
        <span className="truncate">{toSpanish(team)}</span>
      </span>
      <span className="tabular-nums">{value ?? "–"}</span>
    </div>
  );
}

// ─── Placeholder card (later rounds, no match yet) ────────────────────────────
function PlaceholderCard({ matchNum, homeFeeder, awayFeeder }: { matchNum: number; homeFeeder: number; awayFeeder: number }) {
  return (
    <div className="w-full rounded-lg border border-dashed border-neutral-800 bg-neutral-900/40 px-2.5 py-2 text-xs">
      <div className="mb-1.5 text-xs font-medium text-neutral-600">Partido {matchNum}</div>
      <PlaceholderRow feeder={homeFeeder} />
      <div className="my-1 border-t border-neutral-800" />
      <PlaceholderRow feeder={awayFeeder} />
    </div>
  );
}

function PlaceholderRow({ feeder }: { feeder: number }) {
  return (
    <div className="flex items-center justify-between gap-1 text-neutral-500">
      <span>Ganador Partido {feeder}</span>
      <span>–</span>
    </div>
  );
}
