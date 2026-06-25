import { cookies } from "next/headers";

import { createServerClient, type CookieOptions } from "@supabase/ssr";

import type { Database } from "@/types/database";

/**
 * Cliente Supabase para Server Components, Server Actions y route handlers.
 * Usa la anon key + cookies de sesión del usuario (respeta RLS).
 *
 * IMPORTANTE: forzamos `cache: "no-store"` en todas las lecturas. Las queries
 * `.select()` son GET y el App Router de Next las guarda en su Data Cache por
 * defecto, lo que provocaba que datos por-usuario (predicciones, etc.) se
 * mostraran obsoletos tras guardarlos y, peor aún, que el caché compartido
 * pudiera servir filas RLS de un usuario a otro. Estos datos son siempre
 * dinámicos (dependen de la sesión), así que nunca deben cachearse.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: ignorable si hay middleware
            // refrescando la sesión.
          }
        },
      },
    },
  );
}

/**
 * Cliente con SERVICE_ROLE_KEY. Hace bypass de RLS.
 * SOLO usar en route handlers de cron / admin del lado servidor.
 * NUNCA importar desde código que llegue al cliente.
 */
export function createServiceRoleClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          /* no-op: el service role no usa cookies de sesión */
        },
      },
    },
  );
}
