"use client";

import { useEffect } from "react";

import { updateTimezone } from "@/lib/profile/actions";

/**
 * Detecta la timezone del navegador y la guarda en el perfil si cambió.
 * No renderiza nada. Se monta una vez (p. ej. en el dashboard).
 */
export function TimezoneSync({ current }: { current: string | null }) {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) {
      void updateTimezone(tz);
    }
  }, [current]);

  return null;
}
