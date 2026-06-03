import { joinPool } from "@/lib/pools/actions";

export default async function JoinPage({
  params,
}: {
  params: { code: string };
}) {
  // joinPool redirige a /pool/[id] si tiene éxito, o devuelve { error }.
  const result = await joinPool(params.code);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-bold">No se pudo unir</h1>
        <p className="text-red-400">{result?.error ?? "Error desconocido"}</p>
        <a href="/dashboard" className="underline hover:text-white">
          Ir al dashboard
        </a>
      </div>
    </main>
  );
}
