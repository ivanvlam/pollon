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

/** Revalida las vistas afectadas por un cambio en datos del torneo. */
function revalidateTournament() {
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/pool/[id]", "page");
  revalidatePath("/pool/[id]/predictions", "page");
  revalidatePath("/pool/[id]/grupos", "page");
  revalidatePath("/pool/[id]/bracket", "page");
}

const resultSchema = z.object({
  homeScore: z.number().int().min(0).max(99),
  awayScore: z.number().int().min(0).max(99),
  winner: z.enum(["home", "away"]).nullable(),
});

/** Marca un partido como 'live' o lo revierte a 'scheduled'. */
export async function setMatchLive(
  matchId: string,
  live: boolean,
): Promise<AdminResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const svc = createServiceRoleClient();
  const { error } = await svc
    .from("matches")
    .update({ status: live ? "live" : "scheduled" })
    .eq("id", matchId);

  if (error) return { ok: false, error: "No se pudo actualizar el estado" };

  revalidateTournament();
  return { ok: true };
}

/** Activa o desactiva un partido (habilita la UI de predicción). */
export async function setMatchActive(
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

  revalidateTournament();
  return { ok: true };
}

/** Activa todos los partidos de una ronda eliminatoria de una vez. */
export async function setRoundActive(
  round: string,
): Promise<AdminResult & { count?: number }> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const svc = createServiceRoleClient();
  const { data, error } = await svc
    .from("matches")
    .update({ is_active: true })
    .eq("round", round)
    .eq("is_active", false)
    .select("id");

  if (error) return { ok: false, error: "No se pudo activar la ronda" };

  revalidateTournament();
  return { ok: true, count: data?.length ?? 0 };
}

/**
 * Guarda manualmente el resultado de un partido (status → finished) y
 * dispara el recálculo de scores. Misma lógica que el resultado venido
 * de la API.
 */
export async function saveMatchResult(
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

  revalidateTournament();
  return { ok: true };
}

/** Sincroniza los jugadores via función SECURITY DEFINER (no requiere service role). */
export async function syncPlayers(): Promise<AdminResult & { count?: number }> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const supabase = createClient();

  const { error } = await supabase.rpc("upsert_players_data", {
    players: PLAYERS_DATA,
  });

  if (error) return { ok: false, error: `Error al sincronizar: ${error.message}` };

  revalidatePath("/admin");
  return { ok: true, count: PLAYERS_DATA.length };
}

/** Sincroniza el fixture completo desde TheSportsDB (todas las rondas, sin windowing). */
export async function syncMatches(): Promise<AdminResult & { count?: number }> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const { fetchWorldCupFixtures } = await import("@/lib/thesportsdb");

  let fixtures;
  try {
    fixtures = await fetchWorldCupFixtures();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al contactar TheSportsDB" };
  }

  if (fixtures.length === 0) return { ok: false, error: "TheSportsDB no devolvió partidos" };

  const svc = createServiceRoleClient();

  // Los partidos ya 'finished' los gobierna el admin (la API gratuita no da
  // el ganador por penales). No los re-escribimos para no borrar un winner
  // puesto a mano.
  const { data: finished } = await svc
    .from("matches")
    .select("external_id")
    .eq("status", "finished");
  const finishedIds = new Set((finished ?? []).map((m) => m.external_id));
  const toUpsert = fixtures.filter((f) => !finishedIds.has(f.external_id));

  if (toUpsert.length === 0) {
    revalidateTournament();
    return { ok: true, count: 0 };
  }

  const { error } = await svc.from("matches").upsert(
    toUpsert.map((f) => ({
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

  revalidateTournament();
  return { ok: true, count: toUpsert.length };
}

/** Marca el campeón real y recalcula puntos. teamName en español (como se almacena en champion_predictions). */
export async function setActualChampion(teamName: string): Promise<AdminResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const { recalculateChampionScores } = await import("@/lib/scoring-service");
  try {
    await recalculateChampionScores(teamName);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error al calcular" };
  }

  revalidateTournament();
  return { ok: true };
}

/** Marca el goleador real y recalcula puntos. */
export async function setActualTopScorer(playerName: string): Promise<AdminResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const svc = createServiceRoleClient();
  const { error } = await svc.rpc("recalculate_top_scorer_scores", {
    p_player_name: playerName,
  });

  if (error) return { ok: false, error: `Error al calcular: ${error.message}` };

  revalidateTournament();
  return { ok: true };
}

// ============================================================
// Panel global de administración (solo ADMIN_EMAIL)
// ============================================================

/** Elimina cualquier polla (cleanup de pruebas). Cascada limpia miembros y scores. */
export async function adminDeletePool(poolId: string): Promise<AdminResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const svc = createServiceRoleClient();
  const { error } = await svc.from("pools").delete().eq("id", poolId);

  if (error) return { ok: false, error: "No se pudo eliminar la polla" };

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Elimina cualquier usuario (cleanup de pruebas). Borra de auth.users; la
 * cascada limpia profile, membresías, predicciones, scores y picks.
 * No permite que el admin se borre a sí mismo.
 */
export async function adminDeleteUser(userId: string): Promise<AdminResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.id === userId) {
    return { ok: false, error: "No puedes eliminarte a ti mismo" };
  }

  const svc = createServiceRoleClient();
  const { error } = await svc.auth.admin.deleteUser(userId);

  if (error) return { ok: false, error: `No se pudo eliminar el usuario: ${error.message}` };

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  return { ok: true };
}
