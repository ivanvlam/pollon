"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { renamePool } from "@/lib/pools/actions";

export function PoolNameForm({
  poolId,
  initialName,
}: {
  poolId: string;
  initialName: string;
}) {
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(initialName);
  const [msg, setMsg] = useState("");
  const [isError, setIsError] = useState(false);
  const [pending, start] = useTransition();

  const trimmed = name.trim();
  const canSave = trimmed.length >= 2 && trimmed !== saved && !pending;

  function save() {
    if (!canSave) return;
    setMsg("");
    start(async () => {
      const r = await renamePool(poolId, trimmed);
      if (r) {
        setIsError(true);
        setMsg(r.error);
      } else {
        setIsError(false);
        setSaved(trimmed);
        setMsg("Nombre actualizado ✓");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="pool-name" className="text-sm font-medium text-neutral-300">
        Nombre de la polla
      </label>
      <div className="flex gap-2">
        <Input
          id="pool-name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
        />
        <Button onClick={save} disabled={!canSave}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
      {msg && (
        <p className={isError ? "text-sm text-red-400" : "text-sm text-emerald-400"}>
          {msg}
        </p>
      )}
    </div>
  );
}
