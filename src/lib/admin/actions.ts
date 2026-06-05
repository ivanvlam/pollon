"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { recalculateMatchScores } from "@/lib/scoring-service";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { PLAYERS_DATA } from "@/lib/players-data";

export type AdminResult = { ok: true } | { ok: false; error: string };

/** Verifica que el usuario actual sea el admin de la app. */
async function assertAdmin(): Promise<AdminResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  if (user.email !== process.env.ADMIN_EMAIL) {
    return { ok: false, error: "No autorizado" };
  }
  return { ok: true };
}

const resultSchema = z.object({
  homeScore: z.number().int().min(0).max(99),
  awayScore: z.number().int().min(0).max(99),
  winner: z.enum(["home", "away"]).nullable(),
});

/** Activa o desactiva un partido (habilita la UI de predicción). */
export async function setMatchActive(
  poolId: string,
  matchId: string,
  active: boolean,
): Promise<AdminResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const svc = createServiceRoleClient();
  const { error } = await svc
    .from("matches")
    .update({ is_active: active })
    .eq("id", matchId);

  if (error) return { ok: false, error: "No se pudo actualizar el partido" };

  revalidatePath(`/pool/${poolId}/admin`);
  return { ok: true };
}

/**
 * Guarda manualmente el resultado de un partido (status → finished) y
 * dispara el recálculo de scores. Misma lógica que el resultado venido
 * de API-Football.
 */
export async function saveMatchResult(
  poolId: string,
  matchId: string,
  input: { homeScore: number; awayScore: number; winner: "home" | "away" | null },
): Promise<AdminResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const parsed = resultSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const svc = createServiceRoleClient();
  const { error } = await svc
    .from("matches")
    .update({
      home_score: parsed.data.homeScore,
      away_score: parsed.data.awayScore,
      winner: parsed.data.winner,
      status: "finished",
    })
    .eq("id", matchId);

  if (error) return { ok: false, error: "No se pudo guardar el resultado" };

  try {
    await recalculateMatchScores(matchId);
  } catch {
    return { ok: false, error: "Resultado guardado, pero falló el recálculo" };
  }

  revalidatePath(`/pool/${poolId}`);
  revalidatePath(`/pool/${poolId}/admin`);
  return { ok: true };
}

/** Sincroniza los jugadores via función SECURITY DEFINER (no requiere service role). */
export async function syncPlayers(poolId: string): Promise<AdminResult & { count?: number }> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const supabase = createClient();

  const { error } = await supabase.rpc("upsert_players_data", {
    players: PLAYERS_DATA,
  });

  if (error) return { ok: false, error: `Error al sincronizar: ${error.message}` };

  revalidatePath(`/pool/${poolId}/admin`);
  return { ok: true, count: PLAYERS_DATA.length };
}

/** Sincroniza el fixture completo desde TheSportsDB (todas las rondas, sin windowing). */
export async function syncMatches(poolId: string): Promise<AdminResult & { count?: number }> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const { fetchWorldCupFixtures } = await import("@/lib/thesportsdb");
  const { createServiceRoleClient: svcClient } = await import("@/lib/supabase/server");

  let fixtures;
  try {
    fixtures = await fetchWorldCupFixtures();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al contactar TheSportsDB" };
  }

  if (fixtures.length === 0) return { ok: false, error: "TheSportsDB no devolvió partidos" };

  const svc = svcClient();
  const { error } = await svc.from("matches").upsert(
    fixtures.map((f) => ({
      external_id: f.external_id,
      round: f.round,
      group_name: f.group_name,
      home_team: f.home_team,
      away_team: f.away_team,
      kickoff_at: f.kickoff_at,
      status: f.status,
      home_score: f.home_score,
      away_score: f.away_score,
      winner: f.winner,
      updated_at: new Date().toISOString(),
      ...(f.round === "group_stage" ? { is_active: true } : {}),
    })),
    { onConflict: "external_id" },
  );

  if (error) return { ok: false, error: `Error al guardar: ${error.message}` };

  revalidatePath(`/pool/${poolId}/admin`);
  revalidatePath(`/pool/${poolId}`);
  return { ok: true, count: fixtures.length };
}

/** Marca el campeón real y recalcula puntos. teamName en español (como se almacena en champion_predictions). */
export async function setActualChampion(
  poolId: string,
  teamName: string,
): Promise<AdminResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const { recalculateChampionScores } = await import("@/lib/scoring-service");
  try {
    await recalculateChampionScores(teamName);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al calcular" };
  }

  revalidatePath(`/pool/${poolId}/admin`);
  revalidatePath(`/pool/${poolId}`);
  return { ok: true };
}

/** Marca el goleador real y recalcula puntos. */
export async function setActualTopScorer(
  poolId: string,
  playerName: string,
): Promise<AdminResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const svc = createServiceRoleClient();
  const { error } = await svc.rpc("recalculate_top_scorer_scores", {
    p_player_name: playerName,
  });

  if (error) return { ok: false, error: `Error al calcular: ${error.message}` };

  revalidatePath(`/pool/${poolId}/admin`);
  revalidatePath(`/pool/${poolId}`);
  return { ok: true };
}
