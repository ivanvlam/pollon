"use server";

import { createClient } from "@/lib/supabase/server";
import { predictionSchema } from "@/lib/validations";

export type PredictionResult = { ok: true } | { ok: false; error: string };

export async function submitPrediction(input: {
  matchId: string;
  predictedHome: number;
  predictedAway: number;
  predictedWinner?: "home" | "away";
}): Promise<PredictionResult> {
  const parsed = predictionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Datos inválidos" };
  }

  const supabase = createClient();

  const { error } = await supabase.rpc("submit_prediction", {
    p_match_id: parsed.data.matchId,
    p_predicted_home: parsed.data.predictedHome,
    p_predicted_away: parsed.data.predictedAway,
    p_predicted_winner: parsed.data.predictedWinner ?? null,
  });

  if (error) {
    // Mensajes legibles para los raise exception del lado DB.
    if (error.message.includes("predictions closed")) {
      return { ok: false, error: "Las predicciones de este partido ya cerraron" };
    }
    if (error.message.includes("not active")) {
      return { ok: false, error: "Este partido aún no está habilitado" };
    }
    return { ok: false, error: "No se pudo guardar la predicción" };
  }

  return { ok: true };
}
