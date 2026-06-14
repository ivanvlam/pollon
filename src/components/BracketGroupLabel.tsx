"use client";

import { useState } from "react";

import type { GroupMatchRow } from "@/components/GroupCard";
import { GroupModal } from "@/components/GroupModal";
import type { StandingRow } from "@/lib/standings";

export interface GroupModalData {
  groupName: string;
  standings: StandingRow[];
  matches: GroupMatchRow[];
}

export function BracketGroupLabel({
  label,
  groupName,
  standings,
  matches,
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
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
