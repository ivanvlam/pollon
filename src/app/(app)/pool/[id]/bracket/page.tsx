import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Flag } from "@/components/Flag";
import { toSpanish } from "@/lib/teamNames";
import { createClient } from "@/lib/supabase/server";
import type { MatchWinner, Round } from "@/types";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: pool } = await supabase.from("pools").select("name").eq("id", params.id).maybeSingle();
  return { title: pool ? `Bracket · ${pool.name}` : "Bracket" };
}

// ─── Geometry ─────────────────────────────────────────────────────────────────
const SLOT_H   = 104;
const TOTAL_H  = 16 * SLOT_H;  // 1664 px
const CARD_W   = 264;
const STUB_W   = 20;
const CONN_W   = 64;
const LINE     = "#3f3f3f";
const HEADER_H = 36;

const ALL_N      = [16, 8, 4, 2, 1];
const ALL_LABELS = ["Dieciseisavos", "Octavos", "Cuartos", "Semis", "Final"];

const colX       = (si: number) => si * (CARD_W + CONN_W);
const stageSlotH = (si: number) => TOTAL_H / ALL_N[si]!;
const midY       = (si: number, i: number) => HEADER_H + (i + 0.5) * stageSlotH(si);
const totalW     = colX(ALL_N.length - 1) + CARD_W;

// ─── R32 hardcoded bracket structure ─────────────────────────────────────────
// Pairs (0,1), (2,3), … each feed one R16 match in order.
// matchNum = FIFA 2026 schedule number.
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

// ─── Group standings helper ───────────────────────────────────────────────────
function computeStandings(
  ms: { home_team: string; away_team: string; home_score: number | null; away_score: number | null; status: string }[]
): string[] {
  const s = new Map<string, { p: number; gf: number; ga: number }>();
  const get = (t: string) => { if (!s.has(t)) s.set(t, { p: 0, gf: 0, ga: 0 }); return s.get(t)!; };
  for (const m of ms) {
    get(m.home_team); get(m.away_team);
    if (m.status !== "finished" || m.home_score === null || m.away_score === null) continue;
    const h = get(m.home_team), a = get(m.away_team);
    h.gf += m.home_score; h.ga += m.away_score;
    a.gf += m.away_score; a.ga += m.home_score;
    if (m.home_score > m.away_score) h.p += 3;
    else if (m.home_score < m.away_score) a.p += 3;
    else { h.p++; a.p++; }
  }
  return [...s.entries()]
    .sort(([, a], [, b]) => {
      if (b.p !== a.p) return b.p - a.p;
      const gdB = b.gf - b.ga, gdA = a.gf - a.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    })
    .map(([t]) => t);
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
        .select("group_name, home_team, away_team, home_score, away_score, status")
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
  const groupLeaders: Record<string, { winner: string | null; runnerUp: string | null }> = {};
  for (const [g, ms] of groupsMap) {
    const sorted = computeStandings(ms);
    groupLeaders[g] = { winner: sorted[0] ?? null, runnerUp: sorted[1] ?? null };
  }

  const resolveTeam = (s: SlotDef): string | null => {
    if (s.type === "best_third") return null;
    const g = groupLeaders[s.group];
    return s.type === "winner" ? (g?.winner ?? null) : (g?.runnerUp ?? null);
  };
  const slotLabel = (s: SlotDef): string => {
    if (s.type === "best_third") return `Mejor 3° (${s.from.join("/")})`;
    return s.type === "winner" ? `1° Grp ${s.group}` : `2° Grp ${s.group}`;
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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bracket</h1>
        <Link href={`/pool/${params.id}`} className="text-sm text-neutral-400 hover:text-white">
          ← Volver al ranking
        </Link>
      </header>

      <p className="text-xs text-neutral-500">
        Desliza horizontalmente para ver todas las rondas.
      </p>

      <div className="overflow-x-auto pb-6">
        <div style={{ position: "relative", width: totalW, height: TOTAL_H + HEADER_H }}>

          {/* ── Column headers ──────────────────────────────────────────── */}
          {ALL_LABELS.map((label, si) => (
            <div
              key={si}
              style={{ position: "absolute", left: colX(si), top: 0, width: CARD_W, height: HEADER_H,
                       display: "flex", alignItems: "center", justifyContent: "center" }}
              className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
            >
              {label}
            </div>
          ))}

          {/* ── R32 slots ───────────────────────────────────────────────── */}
          {R32_DEFS.map((def, i) => {
            const sh   = stageSlotH(0);
            const dbM  = r32Matches[i] ?? null;
            const date = dbM ? dateFmt.format(new Date(dbM.kickoff_at)) : null;
            return (
              <div
                key={i}
                style={{ position: "absolute", left: colX(0), top: HEADER_H + i * sh,
                         width: CARD_W, height: sh, display: "flex", alignItems: "center", padding: "4px 0" }}
              >
                <R32Card
                  matchNum={def.matchNum}
                  date={date}
                  homeTeam={resolveTeam(def.home)}
                  homeLabel={slotLabel(def.home)}
                  awayTeam={resolveTeam(def.away)}
                  awayLabel={slotLabel(def.away)}
                />
              </div>
            );
          })}

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
                  return (
                    <div
                      key={i}
                      style={{ position: "absolute", left: colX(stageIdx), top: HEADER_H + i * sh,
                               width: CARD_W, height: sh, display: "flex", alignItems: "center", padding: "4px 0" }}
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
                        <PlaceholderCard matchNum={matchNum} />
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

// ─── R32 placeholder card ─────────────────────────────────────────────────────
function R32Card({
  matchNum, date, homeTeam, homeLabel, awayTeam, awayLabel,
}: {
  matchNum: number; date: string | null;
  homeTeam: string | null; homeLabel: string;
  awayTeam: string | null; awayLabel: string;
}) {
  return (
    <div className="w-full rounded-lg border border-dashed border-neutral-700 bg-neutral-950/60 px-2.5 py-2 text-xs">
      <div className="mb-1.5 flex items-center justify-between text-[10px] text-neutral-600">
        <span>M{matchNum}</span>
        {date && <span>{date}</span>}
      </div>
      <SlotRow team={homeTeam} label={homeLabel} />
      <div className="my-1 border-t border-neutral-800" />
      <SlotRow team={awayTeam} label={awayLabel} />
    </div>
  );
}

function SlotRow({ team, label }: { team: string | null; label: string }) {
  return team ? (
    <div className="flex items-center gap-1 text-neutral-200">
      <Flag team={team} className="h-[13px] w-[18px]" />
      <span className="min-w-0 flex-1 truncate">{toSpanish(team)}</span>
      <span className="shrink-0 text-[10px] text-neutral-600">{label}</span>
    </div>
  ) : (
    <div className="truncate text-neutral-600">{label}</div>
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
      className="block w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-2.5 py-2 text-xs transition hover:border-neutral-500"
    >
      <div className="mb-1.5 flex items-center justify-between text-[10px] text-neutral-600">
        <span>M{matchNum}</span>
        <span>{dateFmt.format(new Date(match.kickoff_at))}</span>
      </div>
      <TeamRow team={match.home_team} value={homeVal} win={winner === "home"} />
      <div className="my-1 border-t border-neutral-800" />
      <TeamRow team={match.away_team} value={awayVal} win={winner === "away"} />
      <p className="mt-1 text-[10px] text-neutral-600">
        {finished ? "Resultado" : pred ? "Tu pronóstico" : "Sin pronóstico"}
      </p>
    </Link>
  );
}

// ─── Placeholder card (later rounds, no match yet) ────────────────────────────
function PlaceholderCard({ matchNum }: { matchNum: number }) {
  return (
    <div className="w-full rounded-lg border border-dashed border-neutral-800 bg-neutral-950/60 px-2.5 py-2 text-xs">
      <div className="mb-1.5 text-[10px] text-neutral-700">M{matchNum}</div>
      <PlaceholderRow />
      <div className="my-1 border-t border-neutral-900" />
      <PlaceholderRow />
    </div>
  );
}

function TeamRow({ team, value, win }: { team: string; value: number | null; win: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-1 ${win ? "font-semibold text-emerald-400" : "text-neutral-300"}`}>
      <span className="flex min-w-0 items-center gap-1">
        <Flag team={team} className="h-[13px] w-[18px]" />
        <span className="truncate">{toSpanish(team)}</span>
      </span>
      <span className="tabular-nums">{value ?? "–"}</span>
    </div>
  );
}

function PlaceholderRow() {
  return (
    <div className="flex items-center justify-between gap-1 text-neutral-700">
      <span>Por definir</span>
      <span>–</span>
    </div>
  );
}
