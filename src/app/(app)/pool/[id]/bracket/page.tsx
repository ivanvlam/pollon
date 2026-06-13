import React from "react";
import Link from "next/link";

import { Flag } from "@/components/Flag";
import { toSpanish } from "@/lib/teamNames";
import { createClient } from "@/lib/supabase/server";
import type { MatchWinner, Round } from "@/types";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: pool } = await supabase.from("pools").select("name").eq("id", params.id).maybeSingle();
  return { title: pool ? `Bracket · ${pool.name}` : "Bracket" };
}

// ─── Métricas del bracket ────────────────────────────────────────────────────
const SLOT_H = 84;           // px por slot de R32
const TOTAL_H = 16 * SLOT_H; // altura total del bracket (1344 px)
const CARD_W = 200;          // ancho de la tarjeta de partido
const STUB_W = 16;           // tramo horizontal stub → línea vertical
const CONN_W = 40;           // ancho del conector (stub + salida horizontal)
const LINE = "#3f3f3f";      // color de las líneas

const ROUNDS_DEF: { round: Round; label: string; n: number }[] = [
  { round: "round_of_32",  label: "Dieciseisavos", n: 16 },
  { round: "round_of_16",  label: "Octavos",        n: 8  },
  { round: "quarterfinal", label: "Cuartos",         n: 4  },
  { round: "semifinal",    label: "Semis",           n: 2  },
  { round: "final",        label: "Final",           n: 1  },
];

export default async function BracketPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, round, home_team, away_team, kickoff_at, status, home_score, away_score, winner",
    )
    .in("round", ROUNDS_DEF.map((k) => k.round))
    .order("kickoff_at", { ascending: true });

  const all = matches ?? [];

  const { data: myPreds } = await supabase
    .from("predictions")
    .select("match_id, predicted_home, predicted_away, predicted_winner")
    .eq("user_id", uid)
    .in("match_id", all.length > 0 ? all.map((m) => m.id) : ["x"]);
  const predByMatch = new Map((myPreds ?? []).map((p) => [p.match_id, p]));

  const matchesByRound = new Map<Round, typeof all>();
  for (const k of ROUNDS_DEF) {
    matchesByRound.set(k.round, all.filter((m) => m.round === k.round));
  }

  const HEADER_H = 32; // px para los títulos de ronda

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

      {/* ── Bracket ─────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto pb-6">
        <div style={{ position: "relative", height: TOTAL_H + HEADER_H }}>

          {/* Cabeceras de ronda */}
          {(() => {
            let x = 0;
            return ROUNDS_DEF.map((stage, si) => {
              const col = x;
              x += CARD_W + (si < ROUNDS_DEF.length - 1 ? CONN_W : 0);
              return (
                <div
                  key={stage.round}
                  style={{
                    position: "absolute",
                    left: col,
                    top: 0,
                    width: CARD_W,
                    height: HEADER_H,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500"
                >
                  {stage.label}
                </div>
              );
            });
          })()}

          {/* Columnas de partidos + conectores */}
          {(() => {
            let x = 0;
            return ROUNDS_DEF.map((stage, si) => {
              const isLast = si === ROUNDS_DEF.length - 1;
              const slotH = TOTAL_H / stage.n;
              const roundMatches = matchesByRound.get(stage.round) ?? [];
              const colX = x;
              x += CARD_W + (isLast ? 0 : CONN_W);

              return (
                <React.Fragment key={stage.round}>
                  {/* ── Columna de partidos ─────────────────────────── */}
                  {Array.from({ length: stage.n }, (_, i) => {
                    const real = roundMatches[i] ?? null;
                    const slotTop = HEADER_H + i * slotH;

                    return (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          left: colX,
                          top: slotTop,
                          width: CARD_W,
                          height: slotH,
                          display: "flex",
                          alignItems: "center",
                          padding: "4px 0",
                        }}
                      >
                        {real ? (
                          <RealCard
                            match={real}
                            pred={predByMatch.get(real.id) ?? null}
                            poolId={params.id}
                          />
                        ) : (
                          <PlaceholderCard />
                        )}
                      </div>
                    );
                  })}

                  {/* ── Conector hacia la siguiente ronda ───────────── */}
                  {!isLast && (() => {
                    const connX = colX + CARD_W;

                    return (
                      <>
                        {/* Stub horizontal por cada partido */}
                        {Array.from({ length: stage.n }, (_, i) => (
                          <div
                            key={`stub-${i}`}
                            style={{
                              position: "absolute",
                              left: connX,
                              top: HEADER_H + i * slotH + slotH / 2 - 0.5,
                              width: STUB_W,
                              height: 1,
                              background: LINE,
                            }}
                          />
                        ))}

                        {/* Línea vertical + salida horizontal por cada par */}
                        {Array.from({ length: stage.n / 2 }, (_, i) => {
                          const topMid = HEADER_H + (2 * i) * slotH + slotH / 2;
                          const botMid = HEADER_H + (2 * i + 1) * slotH + slotH / 2;
                          const midY = (topMid + botMid) / 2;

                          return (
                            <React.Fragment key={`pair-${i}`}>
                              {/* Línea vertical */}
                              <div
                                style={{
                                  position: "absolute",
                                  left: connX + STUB_W,
                                  top: topMid,
                                  width: 1,
                                  height: botMid - topMid,
                                  background: LINE,
                                }}
                              />
                              {/* Salida horizontal al siguiente partido */}
                              <div
                                style={{
                                  position: "absolute",
                                  left: connX + STUB_W,
                                  top: midY - 0.5,
                                  width: CONN_W - STUB_W,
                                  height: 1,
                                  background: LINE,
                                }}
                              />
                            </React.Fragment>
                          );
                        })}
                      </>
                    );
                  })()}
                </React.Fragment>
              );
            });
          })()}

        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta con partido real ─────────────────────────────────────────────────
function RealCard({
  match,
  pred,
  poolId,
}: {
  match: {
    id: string;
    home_team: string;
    away_team: string;
    status: string;
    home_score: number | null;
    away_score: number | null;
    winner: string | null;
  };
  pred: {
    predicted_home: number | null;
    predicted_away: number | null;
    predicted_winner: string | null;
  } | null;
  poolId: string;
}) {
  const finished = match.status === "finished";
  const homeVal = finished ? match.home_score : (pred?.predicted_home ?? null);
  const awayVal = finished ? match.away_score : (pred?.predicted_away ?? null);
  const winner: MatchWinner | null = finished
    ? (match.winner as MatchWinner | null)
    : ((pred?.predicted_winner as MatchWinner | null) ?? null);

  return (
    <Link
      href={`/pool/${poolId}/predictions#m-${match.id}`}
      className="block w-full rounded-lg border border-neutral-700 bg-neutral-900/60 px-2.5 py-2 text-xs transition hover:border-neutral-500"
    >
      <TeamRow team={match.home_team} value={homeVal} win={winner === "home"} />
      <div className="my-1 border-t border-neutral-800" />
      <TeamRow team={match.away_team} value={awayVal} win={winner === "away"} />
      <p className="mt-1 text-[10px] text-neutral-600">
        {finished ? "Resultado" : pred ? "Tu pronóstico" : "Sin pronóstico"}
      </p>
    </Link>
  );
}

function PlaceholderCard() {
  return (
    <div className="w-full rounded-lg border border-dashed border-neutral-800 bg-neutral-950/60 px-2.5 py-2 text-xs">
      <PlaceholderRow />
      <div className="my-1 border-t border-neutral-900" />
      <PlaceholderRow />
    </div>
  );
}

function TeamRow({
  team,
  value,
  win,
}: {
  team: string;
  value: number | null;
  win: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-1 ${win ? "font-semibold text-emerald-400" : "text-neutral-300"}`}>
      <span className="flex min-w-0 items-center gap-1">
        <Flag team={team} />
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
