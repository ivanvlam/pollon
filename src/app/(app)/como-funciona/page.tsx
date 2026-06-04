import Link from "next/link";

import { Card } from "@/components/ui/Card";

export const metadata = { title: "Cómo funciona" };

export default function ComoFuncionaPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cómo funciona</h1>
        <Link href="/dashboard" className="text-sm text-neutral-400 hover:text-white">
          ← Volver
        </Link>
      </header>

      <p className="text-neutral-400">
        Predice el marcador de cada partido del Mundial 2026 y suma puntos.
        Compites con tus amigos dentro de cada polla.
      </p>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Fase de grupos</h2>
        <ul className="flex flex-col gap-2 text-sm text-neutral-300">
          <li>
            <span className="font-semibold text-emerald-400">3 pts</span>:
            marcador exacto (predices 2-1 y termina 2-1).
          </li>
          <li>
            <span className="font-semibold text-emerald-400">1 pt</span>:
            aciertas el ganador o el empate, pero no el marcador exacto.
          </li>
          <li className="text-neutral-500">Son excluyentes: o 3, o 1, o 0.</li>
        </ul>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Fase eliminatoria</h2>
        <ul className="flex flex-col gap-2 text-sm text-neutral-300">
          <li>
            <span className="font-semibold text-emerald-400">2 pts</span>: por
            acertar quién clasifica.
          </li>
          <li>
            <span className="font-semibold text-emerald-400">+2 pts</span>: por
            el marcador exacto a los 90 minutos.
          </li>
          <li className="text-neutral-500">
            Se suman (máximo 4). El marcador es siempre a 90 minutos. Si predices
            empate, eliges quién clasifica (la serie se define en prórroga o
            penales); si no, clasifica el ganador del partido.
          </li>
        </ul>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Campeón del Mundial</h2>
        <ul className="flex flex-col gap-2 text-sm text-neutral-300">
          <li>
            <span className="font-semibold text-emerald-400">10 pts</span>: si
            aciertas el campeón.
          </li>
          <li className="text-neutral-500">
            Se elige hasta 1 hora antes del primer partido del torneo y es
            independiente de tu predicción de la final.
          </li>
        </ul>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Cierre y desempates</h2>
        <ul className="flex flex-col gap-2 text-sm text-neutral-300">
          <li>
            Las predicciones de cada partido se cierran 1 hora antes del
            inicio. Después no se pueden cambiar.
          </li>
          <li>
            Cuando un partido cierra, puedes ver las predicciones del resto de la
            polla.
          </li>
          <li className="text-neutral-500">
            Desempate del ranking: más marcadores exactos, luego más ganadores
            acertados, luego campeón acertado, y por último orden alfabético.
          </li>
        </ul>
      </Card>
    </div>
  );
}
