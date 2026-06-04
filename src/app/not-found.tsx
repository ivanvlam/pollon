import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-neutral-400">No encontramos lo que buscabas.</p>
      <Link href="/dashboard" className="text-emerald-400 hover:underline">
        Volver al inicio
      </Link>
    </main>
  );
}
