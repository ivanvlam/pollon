import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BracketMobileCarousel } from "@/components/BracketMobileCarousel";
import { BracketRealCard } from "@/components/BracketRealCard";
import { Flag } from "@/components/Flag";
import type { GroupMatchRow } from "@/components/GroupCard";
import { BracketGroupLabel, type GroupModalData } from "@/components/BracketGroupLabel";
import { TeamName } from "@/components/TeamName";
import {
  BRACKET_ORDER,
  KNOCKOUT_MATCHES,
  type KnockoutSlot,
} from "@/lib/knockoutSchedule";
import { resolveBracket } from "@/lib/matches/resolveBracket";
import { createClient } from "@/lib/supabase/server";
import {
  computeGroupClinch,
  computeGroupStandings,
  resolveFinalClinch,
  type GroupMatch,
  type StandingRow,
} from "@/lib/standings";
import type { Round } from "@/types";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: pool } = await supabase.from("pools").select("name").eq("id", params.id).maybeSingle();
  return { title: pool ? `Bracket · ${pool.name}` : "Bracket" };
}

// ─── Geometry ─────────────────────────────────────────────────────────────────
const SLOT_H   = 96;
const TOTAL_H  = 16 * SLOT_H;
const STUB_W   = 8;
const CONN_W   = 20; // separación entre tarjetas = largo del conector (corto → tarjetas más anchas)
const LINE     = "#606060";
const HEADER_H = 40;

const ALL_N      = [16, 8, 4, 2, 1];
const ALL_LABELS = ["Dieciseisavos", "Octavos", "Cuartos", "Semis", "Final"];
// Etiquetas cortas para las pestañas del carrusel mobile (caben en pantalla).
const MOBILE_TAB_LABELS = ["16avos", "Octavos", "Cuartos", "Semis", "Final"];
const ALL_ROUNDS: Round[] = ["round_of_32", "round_of_16", "quarterfinal", "semifinal", "final"];
// Rondas que se traen de la DB (incluye el 3er puesto, que va fuera del árbol).
const ALL_KO_ROUNDS: Round[] = [...ALL_ROUNDS, "third_place"];

const stageSlotH = (si: number) => TOTAL_H / ALL_N[si]!;
// midY es relativo al cuerpo del bracket (la fila de headers va aparte, sticky).
const midY       = (si: number, i: number) => (i + 0.5) * stageSlotH(si);

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
        .select("id, round, home_team, away_team, kickoff_at, status, home_score, away_score, home_pen, away_pen, winner")
        .in("round", ALL_KO_ROUNDS)
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

  // La resolución de equipos/ganador/partido-de-DB vive en resolveBracket,
  // COMPARTIDA con el cron sync-matches para que ambos coincidan en qué juega
  // cada llave. Aquí solo se le añade encima la etiqueta ("1° Grupo X" / "Ganador
  // Partido N") y el groupData del modal, que son cosa de la vista.
  const resolvedSlots = resolveBracket(standingsByGroup, allKnockout ?? []);

  const sideInfo = (slot: KnockoutSlot, team: string | null): SideInfo => {
    if (slot.type === "feeder")
      return { team, label: `Ganador Partido ${slot.matchNum}`, groupData: null, feeder: slot.matchNum };
    if (slot.type === "loser")
      return { team, label: `Perdedor Partido ${slot.matchNum}`, groupData: null, feeder: slot.matchNum };
    const pos = slot.type === "winner" ? "1°" : slot.type === "runnerUp" ? "2°" : "3°";
    return {
      team,
      label: `${pos} Grupo ${slot.group}`,
      groupData: groupModalDataMap.get(slot.group) ?? null,
      feeder: null,
    };
  };

  const slotByNum = new Map<number, SlotInfo>();
  for (const num of Object.keys(KNOCKOUT_MATCHES).map(Number)) {
    const def = KNOCKOUT_MATCHES[num]!;
    const rs = resolvedSlots.get(num)!;
    slotByNum.set(num, {
      num,
      round: rs.round,
      home: sideInfo(def.home, rs.homeTeam),
      away: sideInfo(def.away, rs.awayTeam),
      match: rs.dbMatch,
      kickoff: rs.dbMatch?.kickoff_at ?? rs.kickoff,
      winnerTeam: rs.winnerTeam,
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
  const penOf = (m: KoMatch | null, team: string | null): number | null => {
    if (!m || !team || m.status !== "finished") return null;
    return m.home_team === team ? m.home_pen : m.away_team === team ? m.away_pen : null;
  };

  // Props de la tarjeta R32 para una llave.
  const r32CardProps = (num: number) => {
    const slot = slotByNum.get(num)!;
    const side = (s: SideInfo): CardSide => ({
      team: s.team,
      label: s.label,
      groupData: s.groupData,
      score: scoreOf(slot.match, s.team),
      pen: penOf(slot.match, s.team),
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

  // Geometría horizontal responsive (desktop): cada columna ocupa 1/3 del ancho
  // VISIBLE del contenedor (unidades de container-query), así entran siempre
  // exactamente 3 rondas y el scroll-snap es magnético. La separación entre
  // tarjetas queda fija en CONN_W px (para los conectores). Lo vertical sigue px.
  const PITCH    = "(100cqw / 3)";                         // ancho de una columna
  const colXc    = (si: number) => `calc(${si} * ${PITCH})`;
  const cardWc   = `calc(${PITCH} - ${CONN_W}px)`;
  const totalWc  = `calc(${ALL_ROUNDS.length} * ${PITCH})`;
  const connXc   = (si: number) => `calc(${si + 1} * ${PITCH} - ${CONN_W}px)`; // borde derecho de la tarjeta

  // Render de una llave de ronda siguiente (octavos+): tarjeta real con link si
  // el partido ya existe en la DB; si no, tarjeta con equipos resueltos (o
  // "Ganador Partido N") y el horario del fixture.
  const renderLater = (num: number) => {
    const slot = slotByNum.get(num)!;
    if (slot.match) {
      return (
        <BracketRealCard
          match={slot.match}
          matchNum={num}
          pred={predBy.get(slot.match.id) ?? null}
          poolId={params.id}
          date={dateFmt.format(new Date(slot.match.kickoff_at))}
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

      {/* ── Mobile: carrusel por ronda (pestañas + swipe lateral con snap) ── */}
      <BracketMobileCarousel
        rounds={ALL_ROUNDS.map((round, si) => ({
          tab: MOBILE_TAB_LABELS[si]!,
          content: (
            <div className="flex flex-col gap-2 pb-8">
              {BRACKET_ORDER[round].map((num) =>
                si === 0 ? (
                  <R32Card key={num} {...r32CardProps(num)} />
                ) : (
                  <React.Fragment key={num}>{renderLater(num)}</React.Fragment>
                ),
              )}
              {round === "final" && (
                <div className="mt-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    Tercer puesto
                  </p>
                  {renderLater(103)}
                </div>
              )}
            </div>
          ),
        }))}
      />

      {/* ── Desktop: cuadro completo (swipe horizontal + vertical) ──────── */}
      <p className="hidden text-xs text-neutral-600 md:block">
        Desliza para ver todas las rondas; los encabezados quedan fijos arriba.
      </p>

      <div className="hidden md:block" style={{ containerType: "inline-size" }}>
      <div
        className="overflow-auto rounded-lg border border-neutral-900"
        style={{
          maxHeight: "80vh",
          scrollSnapType: "x mandatory",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ position: "relative", width: totalWc }}>

          {/* Anclas de snap: alto completo (si fueran 1px se salen del viewport al
              hacer scroll vertical y el navegador deja de snappear). Solo hasta
              que queden 3 columnas a la derecha → cada parada muestra 3 rondas. */}
          {Array.from({ length: Math.max(1, ALL_ROUNDS.length - 2) }, (_, si) => (
            <div
              key={`snap-${si}`}
              style={{
                position: "absolute", left: colXc(si), top: 0,
                width: 1, height: TOTAL_H + HEADER_H,
                pointerEvents: "none", scrollSnapAlign: "start",
              }}
            />
          ))}

          {/* Encabezados de columna: fijos al hacer scroll vertical */}
          <div style={{ position: "sticky", top: 0, zIndex: 20, width: totalWc, height: HEADER_H, background: "#0d0d0d" }}>
            {ALL_LABELS.map((label, si) => (
              <div
                key={si}
                style={{
                  position: "absolute", left: colXc(si), top: 0,
                  width: cardWc, height: HEADER_H,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderBottom: "1px solid #262626",
                }}
                className="text-xs font-semibold uppercase tracking-wide text-neutral-300"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Cuerpo del bracket (+ espacio al final para que la última fila no
              quede pegada al borde inferior) */}
          <div style={{ position: "relative", width: totalWc, height: TOTAL_H + 24 }}>

          {/* R32 slots */}
          {r32Order.map((num, i) => (
            <div
              key={num}
              style={{
                position: "absolute", left: colXc(0), top: i * sh0,
                width: cardWc, height: sh0,
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
                left: colXc(0),
                top: slotIdx * sh0,
                width: cardWc,
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
                      position: "absolute", left: colXc(stageIdx), top: i * sh,
                      width: cardWc, height: sh,
                      display: "flex", alignItems: "center", padding: "4px 0",
                    }}
                  >
                    {renderLater(num)}
                  </div>
                ))}
              </React.Fragment>
            );
          })}

          {/* Tercer puesto: en la columna de la final, más abajo y sin conector */}
          <div
            style={{
              position: "absolute", left: colXc(ALL_ROUNDS.length - 1),
              top: TOTAL_H / 2 + 96, width: cardWc,
              display: "flex", flexDirection: "column", padding: "4px 0",
            }}
          >
            <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Tercer puesto
            </p>
            {renderLater(103)}
          </div>

          {/* Connectors */}
          {ALL_N.slice(0, -1).map((n, si) => (
            <React.Fragment key={`conn-${si}`}>
              {Array.from({ length: n }, (_, i) => (
                <div
                  key={`st-${i}`}
                  style={{ position: "absolute", left: connXc(si), top: midY(si, i) - 0.5,
                           width: STUB_W, height: 1, background: LINE }}
                />
              ))}
              {Array.from({ length: n / 2 }, (_, i) => {
                const tY = midY(si, 2 * i);
                const bY = midY(si, 2 * i + 1);
                return (
                  <React.Fragment key={`pr-${i}`}>
                    <div style={{ position: "absolute", left: `calc(${connXc(si)} + ${STUB_W}px)`, top: tY,
                                 width: 1, height: bY - tY, background: LINE }} />
                    <div style={{ position: "absolute", left: `calc(${connXc(si)} + ${STUB_W}px)`, top: (tY + bY) / 2 - 0.5,
                                 width: CONN_W - STUB_W, height: 1, background: LINE }} />
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          ))}

          </div>
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
  pen: number | null; // tanda de penales (solo si el partido se definió ahí)
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

function SlotRow({ team, label, groupData, score, pen, lost }: CardSide) {
  const labelEl = groupData ? <BracketGroupLabel label={label} {...groupData} /> : label;
  // Eliminado (perdió su partido KO) → atenuado, como en la pestaña de grupos.
  return team ? (
    <div className={`flex min-h-[20px] items-center gap-1 text-neutral-100 ${lost ? "opacity-50" : ""}`}>
      <Flag team={team} className="h-[13px] w-[18px] shrink-0" />
      <TeamName team={team} className="min-w-0 flex-1 truncate font-medium" />
      <span className="shrink-0 text-[10px] text-neutral-500">{labelEl}</span>
      {score !== null && (
        <span className="ml-1 shrink-0 tabular-nums font-semibold">
          {score}
          {pen != null && <span className="font-normal text-neutral-400"> ({pen})</span>}
        </span>
      )}
    </div>
  ) : (
    <div className="flex min-h-[20px] items-center text-xs text-neutral-500">{labelEl}</div>
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
      <TeamName team={team} className="min-w-0 flex-1 truncate font-medium" />
    </div>
  ) : (
    <div className="flex min-h-[20px] items-center text-neutral-500">{label}</div>
  );
}
