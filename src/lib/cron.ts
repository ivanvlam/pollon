import type { NextRequest } from "next/server";

/**
 * Verifica el header `Authorization: Bearer ${CRON_SECRET}`.
 * Los endpoints de cron deben llamar a esto ANTES de cualquier lógica.
 */
export function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) {
    // Sin secret configurado (o demasiado corto) → denegar por seguridad.
    return false;
  }
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}
