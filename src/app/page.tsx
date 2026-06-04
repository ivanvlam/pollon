import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-5xl font-bold tracking-tight">
        Pollon <span aria-hidden>⚽</span>
      </h1>
      <p className="max-w-md text-lg text-neutral-400">
        La polla del Mundial 2026. Predice resultados, compite con tus amigos y
        sube en el ranking.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-emerald-500 px-6 py-2.5 font-medium text-neutral-950 transition hover:bg-emerald-400"
        >
          Entrar
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-neutral-700 px-6 py-2.5 font-medium transition hover:bg-neutral-800"
        >
          Crear cuenta
        </Link>
      </div>
    </main>
  );
}
