"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isChampionLocked } from "@/lib/timing";

export type TopScorerResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  player_name: z.string().min(2).max(80),
});

export async function submitTopScorer(playerName: string): Promise<TopScorerResult> {
  const parsed = schema.safeParse({ player_name: playerName });
  if (!parsed.success) return { ok: false, error: "Jugador inválido" };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };

  const { count: poolCount } = await supabase
    .from("pool_members")
    .select("pool_id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if ((poolCount ?? 0) === 0) {
    return { ok: false, error: "Necesitas estar en una polla para predecir" };
  }

  const { data: firstMatch } = await supabase
    .from("matches")
    .select("kickoff_at")
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (isChampionLocked(firstMatch?.kickoff_at ?? null)) {
    return { ok: false, error: "La predicción de goleador ya cerró" };
  }

  const { error } = await supabase
    .from("top_scorer_predictions")
    .upsert(
      { user_id: user.id, player_name: parsed.data.player_name },
      { onConflict: "user_id" },
    );

  if (error) return { ok: false, error: "No se pudo guardar tu goleador" };

  revalidatePath("/champion");
  return { ok: true };
}

export async function setActualTopScorer(playerName: string): Promise<TopScorerResult> {
  const parsed = schema.safeParse({ player_name: playerName });
  if (!parsed.success) return { ok: false, error: "Jugador inválido" };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    return { ok: false, error: "No autorizado" };
  }

  const svc = createServiceRoleClient();
  const { error } = await svc.rpc("recalculate_top_scorer_scores", {
    p_player_name: parsed.data.player_name,
  });

  if (error) return { ok: false, error: `Error al calcular: ${error.message}` };

  return { ok: true };
}
