import type { createClient } from "@/lib/supabase/server";

// ============================================================
// Gate del "Pollon Wrapped"
// ============================================================
// El Wrapped (página + banners) solo se habilita cuando el torneo terminó del
// todo: campeón definido (la final ya finalizó con ganador) Y goleador definido
// (lo marca el admin a mano; se persiste en `tournament_result`).

type ServerClient = ReturnType<typeof createClient>;

export interface WrappedGate {
  /** La final terminó con un ganador → hay campeón. */
  championReady: boolean;
  /** El admin ya marcó el goleador real. */
  topScorerReady: boolean;
  /** Ambos definidos: el Wrapped se puede mostrar. */
  ready: boolean;
}

export async function getWrappedGate(supabase: ServerClient): Promise<WrappedGate> {
  const [{ data: finals }, { data: result }] = await Promise.all([
    supabase
      .from("matches")
      .select("id")
      .eq("round", "final")
      .eq("status", "finished")
      .not("winner", "is", null)
      .limit(1),
    supabase.from("tournament_result").select("top_scorer").maybeSingle(),
  ]);

  const championReady = (finals ?? []).length > 0;
  const topScorerReady = Boolean(result?.top_scorer);
  return { championReady, topScorerReady, ready: championReady && topScorerReady };
}
