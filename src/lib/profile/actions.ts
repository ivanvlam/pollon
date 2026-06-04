"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Guarda la timezone detectada en el browser (Intl.DateTimeFormat) en el
 * perfil del usuario. Idempotente y silenciosa: solo actualiza si hay sesión.
 */
export async function updateTimezone(tz: string): Promise<void> {
  if (!tz || tz.length > 64) return;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ timezone: tz }).eq("id", user.id);
}
