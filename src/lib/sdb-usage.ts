import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Registra cuántos requests se hicieron a TheSportsDB hoy, para vigilar la
 * cuota gratuita (100/día con la clave "3"). Best-effort: si falla el contador
 * NO interrumpe la sincronización.
 */
export async function recordSdbRequests(n: number): Promise<void> {
  if (n <= 0) return;
  try {
    const supabase = createServiceRoleClient();
    await supabase.rpc("increment_api_usage", { p_delta: n });
  } catch {
    // El contador es secundario; nunca debe romper el sync.
  }
}
