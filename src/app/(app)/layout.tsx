import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/LogoutButton";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El middleware ya protege estas rutas; esto es defensa en profundidad.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-800 bg-neutral-950/80 px-6 py-4 backdrop-blur">
        <Link href="/dashboard" className="text-lg font-bold">
          <span className="text-emerald-400">Pollon</span> ⚽
        </Link>
        <LogoutButton />
      </header>
      <div className="mx-auto max-w-4xl px-6 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}
