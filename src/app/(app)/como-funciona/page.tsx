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
            <span className="font-semibold text-emerald-400">5 pts</span>:
            marcador exacto (predices 2-1 y termina 2-1).
          </li>
          <li>
            <span className="font-semibold text-emerald-400">3 pts</span>:
            aciertas el tipo de resultado y la diferencia de goles, pero no el marcador exacto (predices 2-0 y termina 3-1).
          </li>
          <li>
            <span className="font-semibold text-emerald-400">2 pts</span>:
            aciertas solo el ganador o el empate.
          </li>
          <li className="text-neutral-500">Son excluyentes: se aplica el nivel más alto.</li>
        </ul>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Fase eliminatoria</h2>
        <ul className="flex flex-col gap-2 text-sm text-neutral-300">
          <li>
            <span className="font-semibold text-emerald-400">5 pts</span>:
            marcador exacto a 90 minutos + aciertas quién clasifica.
          </li>
          <li>
            <span className="font-semibold text-emerald-400">3 pts</span>:
            tipo de resultado + diferencia de goles correcta + quién clasifica.
          </li>
          <li>
            <span className="font-semibold text-emerald-400">2 pts</span>:
            solo aciertas quién clasifica.
          </li>
          <li className="text-neutral-500">
            El marcador es siempre a 90 minutos. Puedes predecir empate y elegir quién clasifica
            (la serie se define en prórroga o penales).
          </li>
        </ul>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Campeón y Goleador</h2>
        <ul className="flex flex-col gap-2 text-sm text-neutral-300">
          <li>
            <span className="font-semibold text-emerald-400">15 pts</span>: si aciertas el campeón del Mundial.
          </li>
          <li>
            <span className="font-semibold text-emerald-400">10 pts</span>: si aciertas el goleador del torneo.
          </li>
          <li className="text-neutral-500">
            Ambas predicciones se cierran 1 hora antes del primer partido e
            son independientes de las predicciones de partidos.
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
            Desempate: más exactos (5 pts) → más diferencias acertadas (3 pts) → más ganadores (2 pts) → campeón acertado → orden alfabético.
          </li>
        </ul>
      </Card>
    </div>
  );
}
