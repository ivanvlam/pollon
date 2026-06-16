"use client";

import { useState } from "react";

import {
  RankingHistoryChart,
  type ChartMember,
  type HistoryPoint,
} from "@/components/RankingHistoryChart";
import { RankingRaceChart } from "@/components/RankingRaceChart";
import { cn } from "@/lib/cn";

interface Props {
  history: HistoryPoint[];
  members: ChartMember[];
  poolId: string;
  totalMatches: number;
}

const VIEWS = [
  { id: "chart", label: "Gráfico" },
  { id: "race", label: "Carrera" },
] as const;

type View = (typeof VIEWS)[number]["id"];

/** Historial con toggle entre el gráfico de posiciones y la carrera de autos.
 *  Ambas vistas consumen exactamente los mismos datos. */
export function HistorialView({ history, members, poolId, totalMatches }: Props) {
  const [view, setView] = useState<View>("chart");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-neutral-800 p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                view === v.id
                  ? "bg-emerald-500 text-neutral-950"
                  : "text-neutral-400 hover:text-neutral-100",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === "chart" ? (
        <RankingHistoryChart history={history} members={members} poolId={poolId} />
      ) : (
        <RankingRaceChart
          history={history}
          members={members}
          poolId={poolId}
          totalMatches={totalMatches}
        />
      )}
    </div>
  );
}
