"use client";

import { useCallback, useRef, useState } from "react";

import { TeamModal } from "@/components/TeamModal";
import type { StandingRow } from "@/lib/standings";
import { toSpanish } from "@/lib/teamNames";

interface TeamData {
  standing: StandingRow | null;
  matches: Array<{
    id: string;
    home_team: string;
    away_team: string;
    kickoff_at: string;
    status: string;
    home_score: number | null;
    away_score: number | null;
    is_active: boolean;
    live_minute: string | null;
    group_name: string | null;
    pred: {
      predicted_home: number | null;
      predicted_away: number | null;
      predicted_winner: string | null;
    } | null;
  }>;
  groupName: string | null;
  position: number | null;
}

export function TeamName({
  team,
  className = "",
}: {
  team: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dataRef = useRef<TeamData | null>(null);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!dataRef.current) {
        setLoading(true);
        try {
          const res = await fetch(`/api/team/${encodeURIComponent(team)}`);
          dataRef.current = await res.json();
        } finally {
          setLoading(false);
        }
      }
      setOpen(true);
    },
    [team],
  );

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline text-left transition-colors hover:text-neutral-100 hover:underline underline-offset-2 ${loading ? "opacity-60" : ""} ${className}`}
        aria-label={`Ver estadísticas de ${toSpanish(team)}`}
      >
        {toSpanish(team)}
      </button>
      {open && dataRef.current && (
        <TeamModal
          team={team}
          standing={dataRef.current.standing}
          matches={dataRef.current.matches}
          groupName={dataRef.current.groupName}
          position={dataRef.current.position}
          onClose={() => {
            setOpen(false);
            dataRef.current = null;
          }}
        />
      )}
    </>
  );
}
