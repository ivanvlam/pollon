"use client";

import { useCallback, useRef, useState } from "react";

import type { GroupMatchRow } from "@/components/GroupCard";
import { GroupModal } from "@/components/GroupModal";
import { TeamModal } from "@/components/TeamModal";
import type { GroupClinch, StandingRow } from "@/lib/standings";
import type { TeamProgress } from "@/lib/teamProgress";
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
    round?: string | null;
    pred: {
      predicted_home: number | null;
      predicted_away: number | null;
      predicted_winner: string | null;
    } | null;
  }>;
  groupName: string | null;
  position: number | null;
  progress?: TeamProgress | null;
  // Tabla completa del grupo (para abrir su modal desde el del equipo).
  group: {
    name: string;
    standings: StandingRow[];
    matches: GroupMatchRow[];
    clinch: Array<[string, GroupClinch]>;
  } | null;
  qualifyingThirds: string[];
}

export function TeamName({
  team,
  className = "",
}: {
  team: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(false);
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

  const group = dataRef.current?.group ?? null;

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
          progress={dataRef.current.progress}
          onOpenGroup={
            group
              ? () => {
                  setOpen(false);
                  setOpenGroup(true);
                }
              : undefined
          }
          onClose={() => {
            setOpen(false);
            dataRef.current = null;
          }}
        />
      )}
      {openGroup && group && (
        <GroupModal
          name={group.name}
          standings={group.standings}
          matches={group.matches}
          clinch={new Map(group.clinch)}
          qualifyingThirds={new Set(dataRef.current?.qualifyingThirds ?? [])}
          onClose={() => {
            setOpenGroup(false);
            dataRef.current = null;
          }}
        />
      )}
    </>
  );
}
