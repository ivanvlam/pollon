import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold">Pollon ⚽</h1>
      <p className="max-w-md text-lg text-neutral-400">
        La polla del Mundial 2026. Predice resultados, compite con tus amigos y
        sube en el ranking.
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-white px-6 py-2 font-medium text-black transition hover:bg-neutral-200"
        >
          Entrar
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-neutral-600 px-6 py-2 font-medium transition hover:bg-neutral-800"
        >
          Crear cuenta
        </Link>
      </div>
    </main>
  );
}
