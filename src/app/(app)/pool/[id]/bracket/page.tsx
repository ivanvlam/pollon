import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Flag } from "@/components/Flag";
import type { GroupMatchRow } from "@/components/GroupCard";
import { BracketGroupLabel, type GroupModalData } from "@/components/BracketGroupLabel";
import { TeamName } from "@/components/TeamName";
import {
  BRACKET_ORDER,
  KNOCKOUT_MATCHES,
  type KnockoutSlot,
} from "@/lib/knockoutSchedule";
import { toSpanish } from "@/lib/teamNames";
import { createClient } from "@/lib/supabase/server";
import {
  computeGroupClinch,
  computeGroupStandings,
  resolveFinalClinch,
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
const ALL_ROUNDS: Round[] = ["round_of_32", "round_of_16", "quarterfinal", "semifinal", "final"];

const colX       = (si: number) => si * (CARD_W + CONN_W);
const stageSlotH = (si: number) => TOTAL_H / ALL_N[si]!;
// midY es relativo al cuerpo del bracket (la fila de headers va aparte, sticky).
const midY       = (si: number, i: number) => (i + 0.5) * stageSlotH(si);
const totalW     = colX(ALL_N.length - 1) + CARD_W;

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
        .in("round", ALL_ROUNDS)
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

  const standingsByGroup = new Map<string, StandingRow[]>();
  const groupModalDataMap = new Map<string, GroupModalData>();
  const groupThirds: StandingRow[] = [];
  for (const [g, ms] of groupsMap) {
    const standings = computeGroupStandings(ms);
    standingsByGroup.set(g, standings);
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
    groupModalDataMap.set(g, {
      groupName: `Grupo ${g}`,
      standings,
      matches: modalMatches,
      clinch: computeGroupClinch(ms as GroupMatch[]),
    });
  }

  groupThirds.sort((a, b) => b.points - a.points || b.gd - a.gd || a.team.localeCompare(b.team));
  const qualifyingThirds = new Set(groupThirds.slice(0, 8).map((r) => r.team));
  const groupStageComplete =
    (groupMatches ?? []).length > 0 && (groupMatches ?? []).every((m) => m.status === "finished");
  for (const data of groupModalDataMap.values()) {
    data.qualifyingThirds = qualifyingThirds;
    if (data.clinch) {
      data.clinch = resolveFinalClinch(data.clinch, data.standings, qualifyingThirds, groupStageComplete);
    }
  }

  // ── Resolución de cada llave del bracket (desde el fixture oficial) ─────────
  type KoMatch = NonNullable<typeof allKnockout>[number];
  interface SideInfo {
    team: string | null;
    label: string;                 // "1° Grupo X" / "3° Grupo X" / "Ganador Partido N"
    groupData: GroupModalData | null;
    feeder: number | null;
  }
  interface SlotInfo {
    num: number;
    round: Round;
    home: SideInfo;
    away: SideInfo;
    match: KoMatch | null;         // partido real de la DB (matcheado por equipos)
    kickoff: string;               // de la DB si existe, si no del schedule
    winnerTeam: string | null;
  }

  const winnerTeamOf = (m: KoMatch | null): string | null =>
    m && m.status === "finished" && m.winner
      ? (m.winner === "home" ? m.home_team : m.away_team)
      : null;

  const resolveGroupSide = (slot: Extract<KnockoutSlot, { group: string }>): SideInfo => {
    const s = standingsByGroup.get(slot.group);
    const idx = slot.type === "winner" ? 0 : slot.type === "runnerUp" ? 1 : 2;
    const team = s?.[idx]?.team ?? null;
    const pos = slot.type === "winner" ? "1°" : slot.type === "runnerUp" ? "2°" : "3°";
    return {
      team,
      label: `${pos} Grupo ${slot.group}`,
      groupData: groupModalDataMap.get(slot.group) ?? null,
      feeder: null,
    };
  };

  // DB knockout por ronda (para matchear por equipos).
  const dbByRound = new Map<Round, KoMatch[]>();
  const usedByRound = new Map<Round, Set<string>>();
  for (const round of ALL_ROUNDS) { dbByRound.set(round, []); usedByRound.set(round, new Set()); }
  for (const m of allKnockout ?? []) dbByRound.get(m.round as Round)?.push(m);

  const slotByNum = new Map<number, SlotInfo>();
  const nums = Object.keys(KNOCKOUT_MATCHES).map(Number).sort((a, b) => a - b);
  for (const num of nums) {
    const def = KNOCKOUT_MATCHES[num]!;
    const resolveSide = (slot: KnockoutSlot): SideInfo => {
      if (slot.type === "feeder") {
        const fed = slotByNum.get(slot.matchNum);
        const team = fed?.winnerTeam ?? null;
        return { team, label: `Ganador Partido ${slot.matchNum}`, groupData: null, feeder: slot.matchNum };
      }
      return resolveGroupSide(slot);
    };
    const home = resolveSide(def.home);
    const away = resolveSide(def.away);

    const known = [home.team, away.team].filter((t): t is string => t !== null);
    const dbList = dbByRound.get(def.round) ?? [];
    const used = usedByRound.get(def.round)!;
    let match: KoMatch | null = null;
    if (known.length > 0) {
      match = dbList.find(
        (m) => !used.has(m.id) && known.every((t) => m.home_team === t || m.away_team === t),
      ) ?? null;
      if (match) used.add(match.id);
    }
    slotByNum.set(num, {
      num, round: def.round, home, away, match,
      kickoff: match?.kickoff_at ?? def.kickoff,
      winnerTeam: winnerTeamOf(match),
    });
  }

  // ── Mis predicciones (rondas siguientes a R32, para las tarjetas con link) ──
  const laterIds = (allKnockout ?? []).filter((m) => m.round !== "round_of_32").map((m) => m.id);
  const { data: preds } = laterIds.length > 0
    ? await supabase.from("predictions")
        .select("match_id, predicted_home, predicted_away, predicted_winner")
        .eq("user_id", uid).in("match_id", laterIds)
    : { data: [] };
  const predBy = new Map((preds ?? []).map((p) => [p.match_id, p]));

  const scoreOf = (m: KoMatch | null, team: string | null): number | null => {
    if (!m || !team || m.status !== "finished") return null;
    return m.home_team === team ? m.home_score : m.away_team === team ? m.away_score : null;
  };

  // Props de la tarjeta R32 para una llave.
  const r32CardProps = (num: number) => {
    const slot = slotByNum.get(num)!;
    const side = (s: SideInfo): CardSide => ({
      team: s.team,
      label: s.label,
      groupData: s.groupData,
      score: scoreOf(slot.match, s.team),
      lost:
        slot.match?.status === "finished" &&
        slot.winnerTeam !== null &&
        s.team !== null &&
        slot.winnerTeam !== s.team,
    });
    return {
      matchNum: num,
      date: dateFmt.format(new Date(slot.kickoff)),
      home: side(slot.home),
      away: side(slot.away),
    };
  };

  const sh0 = stageSlotH(0);
  const r32Order = BRACKET_ORDER.round_of_32;

  // Render de una llave de ronda siguiente (octavos+): tarjeta real con link si
  // el partido ya existe en la DB; si no, tarjeta con equipos resueltos (o
  // "Ganador Partido N") y el horario del fixture.
  const renderLater = (num: number) => {
    const slot = slotByNum.get(num)!;
    if (slot.match) {
      return (
        <RealCard
          match={slot.match}
          matchNum={num}
          pred={predBy.get(slot.match.id) ?? null}
          poolId={params.id}
          dateFmt={dateFmt}
        />
      );
    }
    return (
      <ScheduledCard
        matchNum={num}
        date={dateFmt.format(new Date(slot.kickoff))}
        home={slot.home}
        away={slot.away}
      />
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bracket</h1>
        <Link href={`/pool/${params.id}`} className="text-sm text-neutral-400 hover:text-white">
          ← Volver al ranking
        </Link>
      </header>

      {/* ── Mobile: carrusel por ronda (swipe lateral con snap) ────────── */}
      <div
        className="flex snap-x snap-mandatory overflow-auto md:hidden"
        style={{ maxHeight: "75vh", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
      >
        {ALL_ROUNDS.map((round, si) => (
          <section key={round} className="flex w-full shrink-0 snap-start flex-col px-0.5">
            <h2 className="sticky top-0 z-10 mb-3 flex items-center justify-between border-b border-neutral-800 bg-neutral-950 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-300">
              <span>{ALL_LABELS[si]}</span>
              <span className="text-[10px] normal-case text-neutral-600">
                {si + 1}/{ALL_ROUNDS.length} · deslizá →
              </span>
            </h2>
            <div className="flex flex-col gap-2 pb-4">
              {BRACKET_ORDER[round].map((num) =>
                si === 0 ? (
                  <R32Card key={num} {...r32CardProps(num)} />
                ) : (
                  <React.Fragment key={num}>{renderLater(num)}</React.Fragment>
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      {/* ── Desktop: cuadro completo (swipe horizontal + vertical) ──────── */}
      <p className="hidden text-xs text-neutral-600 md:block">
        Deslizá para ver todas las rondas; los encabezados quedan fijos arriba.
      </p>

      <div
        className="hidden overflow-auto rounded-lg border border-neutral-900 md:block"
        style={{ maxHeight: "80vh", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
      >
        <div style={{ position: "relative", width: totalW }}>

          {/* Encabezados de columna: fijos al hacer scroll vertical */}
          <div style={{ position: "sticky", top: 0, zIndex: 20, width: totalW, height: HEADER_H, background: "#0d0d0d" }}>
            {ALL_LABELS.map((label, si) => (
              <div
                key={si}
                style={{
                  position: "absolute", left: colX(si), top: 0,
                  width: CARD_W, height: HEADER_H,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderBottom: "1px solid #262626",
                }}
                className="text-xs font-semibold uppercase tracking-wide text-neutral-300"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Cuerpo del bracket */}
          <div style={{ position: "relative", width: totalW, height: TOTAL_H }}>

          {/* R32 slots */}
          {r32Order.map((num, i) => (
            <div
              key={num}
              style={{
                position: "absolute", left: colX(0), top: i * sh0,
                width: CARD_W, height: sh0,
                display: "flex", alignItems: "center", padding: "4px 0",
              }}
            >
              <R32Card {...r32CardProps(num)} />
            </div>
          ))}

          {[4, 8, 12].map((slotIdx) => (
            <div
              key={`sep-${slotIdx}`}
              style={{
                position: "absolute",
                left: colX(0),
                top: slotIdx * sh0,
                width: CARD_W,
                height: 0,
                borderTop: "1px dashed #2a2a2a",
              }}
            />
          ))}

          {/* Later rounds */}
          {ALL_ROUNDS.slice(1).map((round, si) => {
            const stageIdx = si + 1;
            const sh       = stageSlotH(stageIdx);
            return (
              <React.Fragment key={round}>
                {BRACKET_ORDER[round].map((num, i) => (
                  <div
                    key={num}
                    style={{
                      position: "absolute", left: colX(stageIdx), top: i * sh,
                      width: CARD_W, height: sh,
                      display: "flex", alignItems: "center", padding: "4px 0",
                    }}
                  >
                    {renderLater(num)}
                  </div>
                ))}
              </React.Fragment>
            );
          })}

          {/* Connectors */}
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
    </div>
  );
}

// ─── Tipos/components de tarjeta ────────────────────────────────────────────────
interface CardSide {
  team: string | null;
  label: string;
  groupData: GroupModalData | null;
  score: number | null;
  lost: boolean; // perdió un partido KO terminado → atenuado (eliminado)
}

function R32Card({ matchNum, date, home, away }: { matchNum: number; date: string | null; home: CardSide; away: CardSide }) {
  const played = home.score !== null || away.score !== null;
  return (
    <div className="w-full rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-2 text-xs">
      <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-400">
        <span className="font-medium">Partido {matchNum}</span>
        {date && <span className="text-neutral-500">{date}</span>}
      </div>
      <SlotRow {...home} score={played ? home.score : null} />
      <div className="my-1 border-t border-neutral-800" />
      <SlotRow {...away} score={played ? away.score : null} />
    </div>
  );
}

function SlotRow({ team, label, groupData, score, lost }: CardSide) {
  const labelEl = groupData ? <BracketGroupLabel label={label} {...groupData} /> : label;
  // Eliminado (perdió su partido KO) → atenuado, como en la pestaña de grupos.
  return team ? (
    <div className={`flex min-h-[20px] items-center gap-1 text-neutral-100 ${lost ? "opacity-50" : ""}`}>
      <Flag team={team} className="h-[13px] w-[18px] shrink-0" />
      <TeamName team={team} className="min-w-0 flex-1 truncate font-medium" />
      <span className="shrink-0 text-[10px] text-neutral-500">{labelEl}</span>
      {score !== null && <span className="ml-1 shrink-0 tabular-nums font-semibold">{score}</span>}
    </div>
  ) : (
    <div className="flex min-h-[20px] items-center text-xs text-neutral-500">{labelEl}</div>
  );
}

// Real match card (R16+ ya cargado en la DB).
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
  // Solo se atenúa al perdedor de un partido ya terminado (eliminado).
  const actualWinner: MatchWinner | null = finished ? (match.winner as MatchWinner | null) : null;

  return (
    <Link
      href={`/pool/${poolId}/predictions#m-${match.id}`}
      className="block w-full rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 py-2 text-xs transition hover:border-neutral-700 hover:bg-neutral-800/60"
    >
      <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-400">
        <span className="font-medium">Partido {matchNum}</span>
        <span className="text-neutral-500">{dateFmt.format(new Date(match.kickoff_at))}</span>
      </div>
      <TeamRow team={match.home_team} value={homeVal} lost={actualWinner === "away"} />
      <div className="my-1 border-t border-neutral-800" />
      <TeamRow team={match.away_team} value={awayVal} lost={actualWinner === "home"} />
      <p className="mt-1 text-[10px] text-neutral-500">
        {finished ? "Resultado" : pred ? "Tu pronóstico" : "Sin pronóstico"}
      </p>
    </Link>
  );
}

function TeamRow({ team, value, lost }: { team: string; value: number | null; lost: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-1 text-neutral-200 ${lost ? "opacity-50" : ""}`}>
      <span className="flex min-w-0 items-center gap-1">
        <Flag team={team} className="h-[13px] w-[18px] shrink-0" />
        <span className="truncate">{toSpanish(team)}</span>
      </span>
      <span className="tabular-nums">{value ?? "–"}</span>
    </div>
  );
}

// Scheduled card (R16+ sin partido en DB todavía): muestra el horario oficial y
// los equipos ya resueltos (ganadores que avanzaron) o "Ganador Partido N".
function ScheduledCard({
  matchNum, date, home, away,
}: {
  matchNum: number;
  date: string | null;
  home: { team: string | null; label: string };
  away: { team: string | null; label: string };
}) {
  return (
    <div className="w-full rounded-lg border border-dashed border-neutral-800 bg-neutral-900/40 px-2.5 py-2 text-xs">
      <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-500">
        <span className="font-medium text-neutral-600">Partido {matchNum}</span>
        {date && <span>{date}</span>}
      </div>
      <ScheduledRow team={home.team} label={home.label} />
      <div className="my-1 border-t border-neutral-800" />
      <ScheduledRow team={away.team} label={away.label} />
    </div>
  );
}

function ScheduledRow({ team, label }: { team: string | null; label: string }) {
  return team ? (
    <div className="flex min-h-[20px] items-center gap-1 text-neutral-200">
      <Flag team={team} className="h-[13px] w-[18px] shrink-0" />
      <span className="min-w-0 flex-1 truncate font-medium">{toSpanish(team)}</span>
    </div>
  ) : (
    <div className="flex min-h-[20px] items-center text-neutral-500">{label}</div>
  );
}
