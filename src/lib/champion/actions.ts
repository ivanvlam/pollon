"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const championSchema = z.object({
  team: z.string().min(2, "Equipo inválido").max(60),
});

export type ChampionResult = { ok: true } | { ok: false; error: string };

export async function submitChampion(team: string): Promise<ChampionResult> {
  const parsed = championSchema.safeParse({ team });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("submit_champion", {
    p_team: parsed.data.team,
  });

  if (error) {
    if (error.message.includes("closed")) {
      return { ok: false, error: "La predicción de campeón ya cerró" };
    }
    return { ok: false, error: "No se pudo guardar tu campeón" };
  }

  revalidatePath("/champion");
  return { ok: true };
}
