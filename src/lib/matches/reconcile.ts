// ============================================================
// Pollon — Reconciliación de fixtures de eliminatorias
// ============================================================
// Los partidos de eliminatoria pueden existir en la DB ANTES de que TheSportsDB
// los publique: el admin los carga a mano con un external_id sintético
// ("manual-<uuid>"). Cuando el proveedor finalmente publica ese mismo partido,
// llega con SU propio external_id (idEvent). Un upsert por external_id crearía
// una fila NUEVA → fila duplicada y, peor, las predicciones (que apuntan a
// matches.id) quedarían en la fila vieja mientras la nueva no tiene ninguna.
//
// Solución: antes de upsertear, re-keyear EN SU LUGAR. Para cada fixture KO
// entrante cuyo external_id todavía no existe, buscar una fila de la misma ronda
// con el mismo par de equipos (sin orden) y, si existe, actualizar su
// external_id al del proveedor. Así el upsert posterior cae sobre la fila
// correcta y conserva matches.id (y las predicciones).
//
// En eliminatorias un par de equipos juega a lo sumo una vez, así que
// {ronda + par sin orden} es una clave confiable.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExternalMatch } from "@/lib/thesportsdb";

/** Clave de par de equipos sin orden, normalizada. */
export const teamPairKey = (a: string, b: string): string =>
  [a.trim().toLowerCase(), b.trim().toLowerCase()].sort().join("|");

/**
 * Re-keya en su lugar las filas KO existentes que correspondan a fixtures
 * entrantes con un external_id nuevo. Best-effort: cualquier error se ignora
 * para no romper el sync. Devuelve cuántas filas se re-keyearon.
 */
export async function reconcileKnockoutFixtures(
  svc: SupabaseClient,
  fixtures: ExternalMatch[],
): Promise<number> {
  const koFixtures = fixtures.filter((f) => f.round !== "group_stage");
  if (koFixtures.length === 0) return 0;

  const rounds = [...new Set(koFixtures.map((f) => f.round))];

  const { data: existing } = await svc
    .from("matches")
    .select("id, external_id, round, home_team, away_team")
    .in("round", rounds);

  if (!existing || existing.length === 0) return 0;

  const existingIds = new Set(existing.map((m) => m.external_id));
  // {ronda + par} → fila existente (para re-keyear).
  const byPair = new Map<string, (typeof existing)[number]>();
  for (const m of existing) {
    byPair.set(`${m.round}::${teamPairKey(m.home_team, m.away_team)}`, m);
  }

  let rekeyed = 0;
  for (const f of koFixtures) {
    // Si su external_id ya está en la DB, el upsert normal lo maneja.
    if (existingIds.has(f.external_id)) continue;

    const match = byPair.get(`${f.round}::${teamPairKey(f.home_team, f.away_team)}`);
    // Solo re-keyear si la fila encontrada tiene OTRO external_id (típicamente
    // uno manual). Si coincide, no hay nada que hacer.
    if (!match || match.external_id === f.external_id) continue;

    const { error } = await svc
      .from("matches")
      .update({ external_id: f.external_id })
      .eq("id", match.id);
    if (!error) {
      existingIds.add(f.external_id);
      rekeyed += 1;
    }
  }

  return rekeyed;
}
