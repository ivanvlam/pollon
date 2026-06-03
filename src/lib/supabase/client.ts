import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

/**
 * Cliente Supabase para componentes que corren en el browser ("use client").
 * Usa la anon key — RLS protege el acceso.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
