import Link from "next/link";

import { CreatePoolForm } from "@/components/CreatePoolForm";
import { JoinPoolForm } from "@/components/JoinPoolForm";

export const metadata = { title: "Nueva polla" };

export default function NuevaPollaPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nueva polla</h1>
        <Link href="/dashboard" className="text-sm text-neutral-400 hover:text-white">
          ← Volver
        </Link>
      </header>

      <p className="text-neutral-400">
        Crea una polla nueva y comparte el código con tus amigos, o únete a una
        con el código que te pasaron. Tus predicciones cuentan en todas las
        pollas en las que participes.
      </p>

      <div className="grid gap-8 sm:grid-cols-2">
        <section className="rounded-xl border border-neutral-800 p-6">
          <h2 className="mb-4 text-lg font-semibold">Crear una polla</h2>
          <CreatePoolForm />
        </section>
        <section className="rounded-xl border border-neutral-800 p-6">
          <h2 className="mb-4 text-lg font-semibold">Unirme a una polla</h2>
          <JoinPoolForm />
        </section>
      </div>
    </div>
  );
}
