"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

import { Flag } from "@/components/Flag";
import { buildColorMap, CHART_COLORS } from "@/lib/chart-colors";
import { flagUrl, teamFlagCode } from "@/lib/flags";
import { toSpanish } from "@/lib/teamNames";

export interface HistoryPoint {
  label: string;
  fullLabel: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  homeScore: number | null;
  awayScore: number | null;
  rankings: Record<string, number>;
  pointsEarned: Record<string, number>;
  cumulativePoints: Record<string, number>;
  cumulativeStats?: Record<string, { total: number; exact: number; diff: number; winner: number }>;
  predictions: Record<string, { home: number | null; away: number | null; winner: string | null } | null>;
}

export interface ChartMember {
  id: string;
  name: string;
  currentRank: number;
  currentPoints: number;
}

interface Props {
  history: HistoryPoint[];
  members: ChartMember[];
  poolId: string;
}

const MIN_COL = 56;
const ROW_H = 48;
const PAD_L = 185;
const PAD_R = 172;
const PAD_T = 24;
const PAD_B = 42;
const DOT_R = 8;
const LINE_W = 3;
const FLAG_W = 18;
const FLAG_H = 13;

const DATE_FMT = new Intl.DateTimeFormat("es", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function RankingHistoryChart({ history, members, poolId }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [cw, setCw] = useState(0);
  const [sel, setSel] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setCw(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (history.length < 2 || members.length < 2) return null;

  const N = members.length;
  const nC = history.length;
  const rowH = N <= 8 ? ROW_H : N <= 14 ? 36 : 28;

  const minW = PAD_L + MIN_COL * (nC - 1) + PAD_R;
  const colStep = cw >= minW ? (cw - PAD_L - PAD_R) / (nC - 1) : MIN_COL;
  const W = PAD_L + colStep * (nC - 1) + PAD_R;
  const H = PAD_T + N * rowH + PAD_B;

  const cx = (i: number) => PAD_L + i * colStep;
  const ry = (r: number) => PAD_T + (r - 0.5) * rowH;

  const colorMap = buildColorMap(members.map((m) => m.id));
  const colorOf = (uid: string) => colorMap.get(uid) ?? CHART_COLORS[0]!;

  const buildPath = (uid: string) => {
    const pts = history.map((h, i) => ({ x: cx(i), y: ry(h.rankings[uid] ?? N) }));
    let d = `M ${pts[0]!.x},${pts[0]!.y}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i]!.x},${pts[i]!.y}`;
    return d;
  };

  const trunc = (s: string, n = 18) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const flagY = PAD_T + N * rowH + 12;

  const selPt = sel !== null ? history[sel] : null;

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={wrapRef}
        className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950"
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          style={{ display: "block" }}
          aria-label="Historial de posiciones"
        >
          {/* Horizontal guides */}
          {Array.from({ length: N }, (_, i) => (
            <line
              key={i}
              x1={PAD_L}
              y1={ry(i + 1)}
              x2={cx(nC - 1)}
              y2={ry(i + 1)}
              stroke="#252525"
              strokeWidth={1}
            />
          ))}

          {/* Column separators */}
          {history.map((_, i) => (
            <line
              key={i}
              x1={cx(i)}
              y1={PAD_T}
              x2={cx(i)}
              y2={PAD_T + N * rowH}
              stroke="#2a2a2a"
              strokeWidth={1}
            />
          ))}

          {/* Selected column highlight */}
          {sel !== null && (
            <rect
              x={cx(sel) - colStep / 2}
              y={PAD_T}
              width={colStep}
              height={N * rowH}
              fill="white"
              opacity={0.05}
              rx={3}
            />
          )}

          {/* Lines */}
          {members.map((m) => (
            <path
              key={m.id}
              d={buildPath(m.id)}
              stroke={colorOf(m.id)}
              strokeWidth={LINE_W}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.65}
            />
          ))}

          {/* Dots */}
          {history.map((h, i) =>
            members.map((m) => (
              <circle
                key={`${i}-${m.id}`}
                cx={cx(i)}
                cy={ry(h.rankings[m.id] ?? N)}
                r={DOT_R}
                fill={colorOf(m.id)}
                stroke="#0d0d0d"
                strokeWidth={2}
              />
            )),
          )}

          {/* Left name labels */}
          {members.map((m) => (
            <a key={m.id} href={`/pool/${poolId}/player/${m.id}`} style={{ cursor: "pointer" }}>
              <text
                x={PAD_L - 22}
                y={ry(history[0]!.rankings[m.id] ?? N) + 5}
                textAnchor="end"
                fontSize={15}
                fontWeight="500"
                fill={colorOf(m.id)}
              >
                {trunc(m.name)}
              </text>
            </a>
          ))}

          {/* Right labels: name + rank + points */}
          {(() => {
            const tiedFinal = new Set(
              members
                .filter((m) => members.some((o) => o.id !== m.id && o.currentRank === m.currentRank))
                .map((m) => m.id),
            );
            return members.map((m) => {
              const endRank = history[history.length - 1]!.rankings[m.id] ?? N;
              const x = cx(nC - 1) + 20;
              const color = colorOf(m.id);
              const rankLabel = tiedFinal.has(m.id) ? `=${m.currentRank}°` : `${m.currentRank}°`;
              return (
                <a key={m.id} href={`/pool/${poolId}/player/${m.id}`} style={{ cursor: "pointer" }}>
                  <text x={x} y={ry(endRank) - 3} fontSize={14} fontWeight="500" fill={color}>
                    {trunc(m.name, 14)}
                  </text>
                  <text x={x} y={ry(endRank) + 13} fontSize={13} fontWeight="600" fill="#909090">
                    {rankLabel} · {m.currentPoints} pts
                  </text>
                </a>
              );
            });
          })()}

          {/* X-axis flags */}
          {history.map((h, i) => {
            const homeCode = teamFlagCode(h.homeTeam);
            const awayCode = teamFlagCode(h.awayTeam);
            const gap = 8;
            const totalFW = FLAG_W * 2 + gap;
            const startX = cx(i) - totalFW / 2;
            return (
              <g key={i}>
                {homeCode && (
                  <image href={flagUrl(homeCode)} x={startX} y={flagY} width={FLAG_W} height={FLAG_H} />
                )}
                <text
                  x={cx(i)}
                  y={flagY + FLAG_H / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9}
                  fill="#555"
                >
                  -
                </text>
                {awayCode && (
                  <image href={flagUrl(awayCode)} x={startX + FLAG_W + gap} y={flagY} width={FLAG_W} height={FLAG_H} />
                )}
              </g>
            );
          })}

          {/* Clickable hit areas */}
          {history.map((_, i) => {
            const x1 = i === 0 ? PAD_L : cx(i) - colStep / 2;
            const x2 = i === nC - 1 ? cx(nC - 1) : cx(i) + colStep / 2;
            return (
              <rect
                key={i}
                x={x1}
                y={0}
                width={x2 - x1}
                height={H}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => setSel(sel === i ? null : i)}
              />
            );
          })}
        </svg>
      </div>

      <p className="text-center text-xs text-neutral-600">
        Aprieta las banderas para ver los detalles del partido
      </p>

      {/* Detail panel */}
      {selPt && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-4 text-sm">
          {/* Match header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
                <div className="flex items-center justify-end gap-1.5 min-w-0">
                  <span className="text-sm font-medium text-right leading-tight truncate">
                    {toSpanish(selPt.homeTeam)}
                  </span>
                  <Flag team={selPt.homeTeam} className="shrink-0" />
                </div>
                <span className="text-xl font-bold tabular-nums whitespace-nowrap px-1 text-neutral-100">
                  {selPt.homeScore ?? "–"}&nbsp;–&nbsp;{selPt.awayScore ?? "–"}
                </span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Flag team={selPt.awayTeam} className="shrink-0" />
                  <span className="text-sm font-medium leading-tight truncate">
                    {toSpanish(selPt.awayTeam)}
                  </span>
                </div>
              </div>
              <p className="text-center text-xs text-neutral-500 mt-1">
                {DATE_FMT.format(new Date(selPt.kickoffAt))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSel(null)}
              className="shrink-0 text-xs text-neutral-500 hover:text-neutral-300"
            >
              ✕
            </button>
          </div>

          {/* Player rows */}
          <div className="mt-4 flex flex-col gap-2 border-t border-neutral-800 pt-3">
            {(() => {
              const sorted = [...members].sort((a, b) => (selPt.rankings[a.id] ?? N) - (selPt.rankings[b.id] ?? N));
              const isTiedStats = (aId: string, bId: string) => {
                const sa = selPt.cumulativeStats?.[aId];
                const sb = selPt.cumulativeStats?.[bId];
                if (sa && sb) {
                  return sa.total === sb.total && sa.exact === sb.exact && sa.diff === sb.diff && sa.winner === sb.winner;
                }
                return (selPt.cumulativePoints[aId] ?? 0) === (selPt.cumulativePoints[bId] ?? 0);
              };
              const dispRank: Record<string, number> = {};
              sorted.forEach((m, i) => {
                if (i > 0 && isTiedStats(m.id, sorted[i - 1]!.id)) {
                  dispRank[m.id] = dispRank[sorted[i - 1]!.id]!;
                } else {
                  dispRank[m.id] = i + 1;
                }
              });
              const tiedRanks = new Set(
                sorted.filter((m) => sorted.some((o) => o.id !== m.id && isTiedStats(m.id, o.id))).map((m) => m.id),
              );
              return sorted.map((m) => {
                const earned = selPt.pointsEarned[m.id] ?? 0;
                const cumul = selPt.cumulativePoints[m.id] ?? 0;
                const rank = dispRank[m.id] ?? (selPt.rankings[m.id] ?? N);
                const pred = selPt.predictions[m.id];
                const predText =
                  pred?.home !== null && pred?.home !== undefined &&
                  pred?.away !== null && pred?.away !== undefined
                    ? `${pred.home} – ${pred.away}`
                    : "–";
                return (
                  <div key={m.id} className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                      {tiedRanks.has(m.id) ? `=${rank}°` : `${rank}°`}
                    </span>
                    <Link
                      href={`/pool/${poolId}/player/${m.id}`}
                      className="flex-1 truncate font-medium hover:underline"
                      style={{ color: colorOf(m.id) }}
                    >
                      {m.name}
                    </Link>
                    <span className="w-14 shrink-0 text-center text-xs tabular-nums text-neutral-400 whitespace-nowrap">
                      {predText}
                    </span>
                    <span
                      className={`w-8 shrink-0 text-right text-xs font-semibold tabular-nums ${
                        earned > 0 ? "text-emerald-400" : "text-neutral-600"
                      }`}
                    >
                      {earned > 0 ? `+${earned}` : "–"}
                    </span>
                    <span className="w-20 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                      {cumul} puntos
                    </span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
