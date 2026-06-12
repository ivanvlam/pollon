"use client";

import { useLayoutEffect, useRef, useState } from "react";

export interface HistoryPoint {
  label: string;
  fullLabel: string;
  rankings: Record<string, number>;
  pointsEarned: Record<string, number>;
  cumulativePoints: Record<string, number>;
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
}

// Tailwind 400-range palette — readable on dark backgrounds, coherent with the site
const COLORS = [
  "#34d399", // emerald-400 (site accent)
  "#60a5fa", // blue-400
  "#fbbf24", // amber-400
  "#f87171", // red-400
  "#a78bfa", // violet-400
  "#f472b6", // pink-400
  "#2dd4bf", // teal-400
  "#fb923c", // orange-400
  "#a3e635", // lime-400
  "#38bdf8", // sky-400
  "#c084fc", // purple-400
  "#4ade80", // green-400
];

const MIN_COL = 48;
const ROW_H = 52;
const PAD_L = 148;
const PAD_R = 162;
const PAD_T = 20;
const PAD_B = 42;
const DOT_R = 5.5;
const LINE_W = 1.5;

export function RankingHistoryChart({ history, members }: Props) {
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

  const minW = PAD_L + MIN_COL * (nC - 1) + PAD_R;
  const colStep = cw >= minW ? (cw - PAD_L - PAD_R) / (nC - 1) : MIN_COL;
  const W = PAD_L + colStep * (nC - 1) + PAD_R;
  const H = PAD_T + N * ROW_H + PAD_B;

  const cx = (i: number) => PAD_L + i * colStep;
  const ry = (r: number) => PAD_T + (r - 0.5) * ROW_H;

  const colorIdx = new Map(members.map((m, i) => [m.id, i]));
  const colorOf = (uid: string) => COLORS[(colorIdx.get(uid) ?? 0) % COLORS.length]!;

  const buildPath = (uid: string) => {
    const pts = history.map((h, i) => ({ x: cx(i), y: ry(h.rankings[uid] ?? N) }));
    let d = `M ${pts[0]!.x},${pts[0]!.y}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i]!.x},${pts[i]!.y}`;
    }
    return d;
  };

  const trunc = (s: string, n = 18) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  const every = nC <= 12 ? 1 : nC <= 24 ? 2 : nC <= 48 ? 4 : 8;

  const selPt = sel !== null ? history[sel] : null;

  return (
    <div className="flex flex-col gap-4">
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
              stroke="#222"
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
              y2={PAD_T + N * ROW_H}
              stroke="#1a1a1a"
              strokeWidth={1}
            />
          ))}

          {/* Selected column highlight */}
          {sel !== null && (
            <rect
              x={cx(sel) - colStep / 2}
              y={PAD_T}
              width={colStep}
              height={N * ROW_H}
              fill="white"
              opacity={0.05}
              rx={3}
            />
          )}

          {/* Rank position labels */}
          {Array.from({ length: N }, (_, i) => (
            <text
              key={i}
              x={PAD_L - 14}
              y={ry(i + 1) + 4}
              textAnchor="end"
              fontSize={12}
              fontWeight="600"
              fill="#404040"
            >
              {i + 1}°
            </text>
          ))}

          {/* Lines (drawn under dots) */}
          {members.map((m) => (
            <path
              key={m.id}
              d={buildPath(m.id)}
              stroke={colorOf(m.id)}
              strokeWidth={LINE_W}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.55}
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
                strokeWidth={1.5}
              />
            )),
          )}

          {/* Left name labels */}
          {members.map((m) => (
            <text
              key={m.id}
              x={PAD_L - 26}
              y={ry(history[0]!.rankings[m.id] ?? N) + 4}
              textAnchor="end"
              fontSize={11}
              fontWeight="500"
              fill={colorOf(m.id)}
            >
              {trunc(m.name)}
            </text>
          ))}

          {/* Right labels: name + current rank + current points */}
          {members.map((m) => {
            const endRank = history[history.length - 1]!.rankings[m.id] ?? N;
            const x = cx(nC - 1) + 18;
            const color = colorOf(m.id);
            return (
              <g key={m.id}>
                <text x={x} y={ry(endRank) - 4} fontSize={11} fontWeight="500" fill={color}>
                  {trunc(m.name, 14)}
                </text>
                <text x={x} y={ry(endRank) + 10} fontSize={9} fill="#505050">
                  #{m.currentRank} · {m.currentPoints} pts
                </text>
              </g>
            );
          })}

          {/* X-axis match labels */}
          {history.map((h, i) =>
            i % every !== 0 ? null : (
              <g key={i} transform={`translate(${cx(i)}, ${PAD_T + N * ROW_H + 6})`}>
                <line x1={0} y1={0} x2={0} y2={5} stroke="#2e2e2e" strokeWidth={1} />
                <text
                  transform="rotate(-40)"
                  x={0}
                  y={13}
                  textAnchor="end"
                  fontSize={9}
                  fill="#5a5a5a"
                >
                  {h.label}
                </text>
              </g>
            ),
          )}

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

      {/* Detail panel */}
      {selPt && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-4 text-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold text-neutral-200">{selPt.fullLabel}</span>
            <button
              type="button"
              onClick={() => setSel(null)}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {[...members]
              .sort(
                (a, b) =>
                  (selPt.rankings[a.id] ?? N) - (selPt.rankings[b.id] ?? N),
              )
              .map((m) => {
                const earned = selPt.pointsEarned[m.id] ?? 0;
                const cumul = selPt.cumulativePoints[m.id] ?? 0;
                const rank = selPt.rankings[m.id] ?? N;
                return (
                  <div key={m.id} className="flex items-center gap-2">
                    <span className="w-6 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                      {rank}°
                    </span>
                    <span
                      className="flex-1 truncate font-medium"
                      style={{ color: colorOf(m.id) }}
                    >
                      {m.name}
                    </span>
                    <span
                      className={`w-10 shrink-0 text-right text-xs font-semibold tabular-nums ${
                        earned > 0 ? "text-emerald-400" : "text-neutral-600"
                      }`}
                    >
                      {earned > 0 ? `+${earned}` : "–"}
                    </span>
                    <span className="w-24 shrink-0 text-right text-xs tabular-nums text-neutral-500">
                      {cumul} acumulado
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
