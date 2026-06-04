"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";

export function CopyInviteButton({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/join/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Si el navegador bloquea el portapapeles, mostramos el link al menos.
      window.prompt("Copia el link de invitación:", url);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={copy}>
      {copied ? "¡Copiado! ✓" : "Copiar invitación"}
    </Button>
  );
}
