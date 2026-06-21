"use client";

import { useState } from "react";

import { GoalCelebration, type GoalEvent } from "@/components/GoalCelebration";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * Botón de admin para previsualizar la animación de gol sin esperar un partido
 * en vivo. Dispara una `GoalCelebration` con un gol de prueba (lado al azar).
 */
export function AdminGoalTest() {
  const [goal, setGoal] = useState<GoalEvent | null>(null);

  function play() {
    const side: "home" | "away" = Math.random() < 0.5 ? "home" : "away";
    setGoal({
      id: `test-${Date.now()}`,
      homeTeam: "Brazil",
      awayTeam: "Argentina",
      homeScore: side === "home" ? 1 : 0,
      awayScore: side === "away" ? 1 : 0,
      scoringSide: side,
    });
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-semibold">Probar animación de gol</h3>
        <p className="text-sm text-neutral-400">
          Previsualiza la animación de gol (pelota, GOOOL y confeti del equipo)
          sin esperar a un partido en vivo.
        </p>
      </div>
      <div>
        <Button type="button" variant="secondary" onClick={play} disabled={goal !== null}>
          Probar animación
        </Button>
      </div>
      {goal && <GoalCelebration goal={goal} onDone={() => setGoal(null)} />}
    </Card>
  );
}
