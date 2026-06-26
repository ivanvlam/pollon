"use client";

import { useState } from "react";

import type { GroupMatchRow } from "@/components/GroupCard";
import { GroupModal } from "@/components/GroupModal";
import type { GroupClinch, StandingRow } from "@/lib/standings";

export interface GroupModalData {
  groupName: string;
  standings: StandingRow[];
  matches: GroupMatchRow[];
  clinch?: Map<string, GroupClinch>;
  qualifyingThirds?: Set<string>;
}

export function BracketGroupLabel({
  label,
  groupName,
  standings,
  matches,
  clinch,
  qualifyingThirds,
}: GroupModalData & { label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="underline-offset-2 transition-colors hover:text-neutral-200 hover:underline"
      >
        {label}
      </button>
      {open && (
        <GroupModal
          name={groupName}
          standings={standings}
          matches={matches}
          clinch={clinch}
          qualifyingThirds={qualifyingThirds}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
