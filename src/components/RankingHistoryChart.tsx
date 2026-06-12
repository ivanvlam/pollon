"use client";

export interface HistoryPoint {
  label: string;
  rankings: Record<string, number>; // userId -> rank (1 = first)
}

interface Member {
  id: string;
  name: string;
}

interface Props {
  history: HistoryPoint[];
  members: Member[];
}

const COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
  "#84cc16", "#06b6d4", "#a78bfa", "#fb923c",
];

const LABEL_LEFT = 90;
const LABEL_RIGHT = 90;
const COL_STEP = 44;
const ROW_HEIGHT = 44;
const PAD_TOP = 8;
const PAD_BOTTOM = 22;

export function RankingHistoryChart({ history, members }: Props) {
  if (history.length < 2 || members.length < 2) return null;

  const N = members.length;
  const nCols = history.length;

  const totalH = PAD_TOP + N * ROW_HEIGHT + PAD_BOTTOM;
  const totalW = LABEL_LEFT + COL_STEP * (nCols - 1) + LABEL_RIGHT;
  const strokeW = Math.min(ROW_HEIGHT * 0.55, 20);

  const colX = (i: number) => LABEL_LEFT + i * COL_STEP;
  const rankY = (r: number) => PAD_TOP + (r - 0.5) * ROW_HEIGHT;

  const buildPath = (userId: string) => {
    const pts = history.map((h, i) => ({
      x: colX(i),
      y: rankY(h.rankings[userId] ?? N),
    }));
    let d = `M ${pts[0]!.x},${pts[0]!.y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cur = pts[i]!;
      const nxt = pts[i + 1]!;
      const midX = (cur.x + nxt.x) / 2;
      d += ` C ${midX},${cur.y} ${midX},${nxt.y} ${nxt.x},${nxt.y}`;
    }
    return d;
  };

  // Show x-axis labels every N cols to avoid crowding
  const labelEvery = nCols <= 12 ? 1 : nCols <= 24 ? 2 : nCols <= 48 ? 4 : 8;

  const truncate = (s: string, n = 11) =>
    s.length > n ? s.slice(0, n - 1) + "…" : s;

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-900/30">
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        width={totalW}
        height={totalH}
        style={{ display: "block" }}
        aria-label="Historial de posiciones"
      >
        {/* Subtle horizontal grid lines */}
        {Array.from({ length: N }, (_, i) => (
          <line
            key={i}
            x1={LABEL_LEFT}
            y1={rankY(i + 1)}
            x2={LABEL_LEFT + COL_STEP * (nCols - 1)}
            y2={rankY(i + 1)}
            stroke="#1c1c1c"
            strokeWidth={1}
          />
        ))}

        {/* Rank labels (Y axis) */}
        {Array.from({ length: N }, (_, i) => (
          <text
            key={i}
            x={LABEL_LEFT - 8}
            y={rankY(i + 1) + 4}
            textAnchor="end"
            fontSize={10}
            fill="#404040"
          >
            {i + 1}°
          </text>
        ))}

        {/* Bezier bands per member */}
        {members.map((m, idx) => (
          <path
            key={m.id}
            d={buildPath(m.id)}
            stroke={COLORS[idx % COLORS.length]}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.82}
          />
        ))}

        {/* Left name labels (sorted by starting rank) */}
        {members.map((m, idx) => {
          const rank = history[0]?.rankings[m.id] ?? N;
          return (
            <text
              key={m.id}
              x={LABEL_LEFT - 12}
              y={rankY(rank) + 4}
              textAnchor="end"
              fontSize={11}
              fontWeight="500"
              fill={COLORS[idx % COLORS.length]}
            >
              {truncate(m.name)}
            </text>
          );
        })}

        {/* Right name labels (sorted by ending rank) */}
        {members.map((m, idx) => {
          const rank = history[history.length - 1]?.rankings[m.id] ?? N;
          return (
            <text
              key={m.id}
              x={LABEL_LEFT + COL_STEP * (nCols - 1) + 12}
              y={rankY(rank) + 4}
              textAnchor="start"
              fontSize={11}
              fontWeight="500"
              fill={COLORS[idx % COLORS.length]}
            >
              {truncate(m.name)}
            </text>
          );
        })}

        {/* X-axis match labels */}
        {history.map((h, i) =>
          i % labelEvery === 0 ? (
            <text
              key={i}
              x={colX(i)}
              y={PAD_TOP + N * ROW_HEIGHT + 15}
              textAnchor="middle"
              fontSize={8}
              fill="#404040"
            >
              {h.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
