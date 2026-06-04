"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // En producción conviene enviarlo a un servicio de logs.
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h2 className="text-xl font-bold">Algo salió mal</h2>
      <p className="max-w-md text-sm text-neutral-400">
        No pudimos cargar esta sección. Puede ser un problema temporal de
        conexión con la base de datos.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
