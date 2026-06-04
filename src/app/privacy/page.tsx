import Link from "next/link";

export const metadata = {
  title: "Privacidad",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">Política de privacidad</h1>

      <div className="flex flex-col gap-4 text-sm text-neutral-300">
        <p>
          Pollon es una aplicación privada para predecir resultados del Mundial
          2026 entre grupos de amigos. Recopilamos los datos mínimos necesarios
          para que el servicio funcione.
        </p>

        <h2 className="mt-4 text-lg font-semibold text-white">Qué guardamos</h2>
        <ul className="list-disc pl-5">
          <li>Tu email y nombre, para identificarte y enviarte recordatorios.</li>
          <li>Tu zona horaria, para mostrar los horarios de los partidos.</li>
          <li>Tus predicciones y los puntos obtenidos en cada polla.</li>
        </ul>

        <h2 className="mt-4 text-lg font-semibold text-white">Tus derechos</h2>
        <p>
          Conforme al RGPD, puedes solicitar el acceso, la rectificación o la
          eliminación de tus datos escribiéndonos. Al eliminar tu cuenta se
          borran tus predicciones e historial asociados.
        </p>

        <h2 className="mt-4 text-lg font-semibold text-white">Terceros</h2>
        <p>
          Usamos Supabase (autenticación y base de datos), Vercel (hosting) y
          Resend (envío de emails). No vendemos ni compartimos tus datos con
          fines publicitarios.
        </p>
      </div>

      <p className="mt-8">
        <Link href="/" className="text-sm underline">
          Volver al inicio
        </Link>
      </p>
    </main>
  );
}
