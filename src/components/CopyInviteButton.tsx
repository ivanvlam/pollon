"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";

export function CopyInviteButton({
  inviteCode,
  poolName,
  inviterName,
}: {
  inviteCode: string;
  poolName: string;
  inviterName: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/join/${inviteCode}`;
    const message = `¡${inviterName} te ha invitado a unirte a la polla "${poolName}"! ⚽\n${url}`;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Si el navegador bloquea el portapapeles, mostramos el mensaje al menos.
      window.prompt("Copia la invitación:", message);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={copy}>
      {copied ? "¡Copiado! ✓" : "Copiar invitación"}
    </Button>
  );
}
