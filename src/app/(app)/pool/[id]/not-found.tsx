import Link from "next/link";

export default function PoolNotFound() {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <h1 className="text-2xl font-bold">Polla no encontrada</h1>
      <p className="text-neutral-400">
        Esta polla no existe o no tienes acceso a ella.
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
