"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PoolError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <h1 className="text-2xl font-bold">Algo salió mal</h1>
      <p className="text-neutral-400">
        No se pudo cargar la polla. Por favor intenta de nuevo.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Reintentar
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
