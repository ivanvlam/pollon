import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto:
     * - api (las rutas /api/* hacen su propia auth: los cron validan
     *   CRON_SECRET, no la sesión; el middleware las redirigía a /login)
     * - _next/static, _next/image
     * - favicon y archivos estáticos comunes
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
