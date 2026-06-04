// ============================================================
// Pollon — Lógica de cierre / disponibilidad (fuente única de verdad)
// ============================================================
// Toda decisión de "¿está abierto para predecir?" del lado TS pasa por
// aquí. La autoridad final es la base de datos (submit_prediction /
// submit_champion validan con now() del servidor), pero el cliente y los
// Server Components usan estas funciones para mostrar estado y countdown.
//
// IMPORTANTE: el cierre es una duración ABSOLUTA (24h = 86 400 s) antes
// del kickoff, calculada sobre epoch UTC. Por eso es inmune a DST y a la
// timezone del usuario, siempre que kickoff_at venga como ISO con offset
// (Supabase devuelve timestamptz con 'Z'/offset).

import { CHAMPION_LOCK_HOURS, LOCK_HOURS_BEFORE_KICKOFF } from "@/lib/constants";

export const LOCK_MS = LOCK_HOURS_BEFORE_KICKOFF * 3600_000;
export const CHAMPION_LOCK_MS = CHAMPION_LOCK_HOURS * 3600_000;

/** Parsea un ISO timestamp a epoch ms. Devuelve NaN si es inválido. */
export function parseKickoff(kickoffAt: string): number {
  return new Date(kickoffAt).getTime();
}

/** Epoch ms en que se cierra la predicción de un partido. */
export function predictionLockTime(kickoffAt: string): number {
  return parseKickoff(kickoffAt) - LOCK_MS;
}

/**
 * ¿La predicción de este partido está cerrada en `now`?
 * Fail-closed: si la fecha es inválida, se considera cerrada (no se
 * permite apostar sobre datos corruptos).
 */
export function isPredictionLocked(
  kickoffAt: string,
  now: number = Date.now(),
): boolean {
  const lock = predictionLockTime(kickoffAt);
  if (Number.isNaN(lock)) return true;
  return now >= lock;
}

/** ms hasta el cierre. Negativo si ya cerró. NaN si la fecha es inválida. */
export function msUntilLock(
  kickoffAt: string,
  now: number = Date.now(),
): number {
  return predictionLockTime(kickoffAt) - now;
}

/**
 * ¿La predicción de campeón está cerrada en `now`?
 * Cierra CHAMPION_LOCK_HOURS (1h) antes del PRIMER partido del torneo. Si
 * aún no hay fixture (firstKickoffAt === null) está abierta — coincide con
 * submit_champion, que con min(kickoff_at) NULL no aplica deadline.
 */
export function isChampionLocked(
  firstKickoffAt: string | null,
  now: number = Date.now(),
): boolean {
  if (firstKickoffAt === null) return false;
  const lock = parseKickoff(firstKickoffAt) - CHAMPION_LOCK_MS;
  if (Number.isNaN(lock)) return false;
  return now >= lock;
}

/**
 * Formatea una duración (ms) como countdown legible.
 * Negativo o cero → "Cerrado".
 */
export function formatCountdown(ms: number): string {
  if (Number.isNaN(ms) || ms <= 0) return "Cerrado";

  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
