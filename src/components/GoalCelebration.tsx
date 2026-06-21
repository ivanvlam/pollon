"use client";

import { useEffect } from "react";

import confetti from "canvas-confetti";

import { Flag } from "@/components/Flag";
import { getTeamColors } from "@/lib/teamColors";
import { toSpanish } from "@/lib/teamNames";

export interface GoalEvent {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  scoringSide: "home" | "away";
}

const DURATION_MS = 2200;
const REDUCED_MS = 1400;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Pelota de fútbol estilizada (SVG, nítida a cualquier tamaño). */
const SoccerBall = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
    <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#111111" strokeWidth="2" />
    {/* costuras desde el pentágono central hacia el borde */}
    <g stroke="#111111" strokeWidth="2.5" strokeLinecap="round">
      <line x1="50" y1="34" x2="50" y2="4" />
      <line x1="65.2" y1="45.1" x2="93.8" y2="35.8" />
      <line x1="59.4" y1="62.9" x2="77" y2="87.2" />
      <line x1="40.6" y1="62.9" x2="23" y2="87.2" />
      <line x1="34.8" y1="45.1" x2="6.2" y2="35.8" />
    </g>
    {/* pentágono central */}
    <polygon points="50,34 65.2,45.1 59.4,62.9 40.6,62.9 34.8,45.1" fill="#111111" />
  </svg>
);

export function GoalCelebration({
  goal,
  onDone,
}: {
  goal: GoalEvent;
  onDone: () => void;
}) {
  const scorer = goal.scoringSide === "home" ? goal.homeTeam : goal.awayTeam;
  const colors = getTeamColors(scorer);
  const accent = colors[0] ?? "#22c55e";

  useEffect(() => {
    const reduced = prefersReducedMotion();
    const timers: number[] = [];

    if (!reduced) {
      document.body.classList.add("goal-shake");
      timers.push(
        window.setTimeout(() => document.body.classList.remove("goal-shake"), 600),
      );

      const fire = (x: number) =>
        confetti({
          particleCount: 90,
          spread: 75,
          startVelocity: 45,
          origin: { x, y: 0.62 },
          colors,
          scalar: 1.1,
          zIndex: 200,
          disableForReducedMotion: true,
        });
      fire(0.5);
      timers.push(window.setTimeout(() => { fire(0.18); fire(0.82); }, 250));
      timers.push(window.setTimeout(() => fire(0.5), 650));
    }

    timers.push(window.setTimeout(onDone, reduced ? REDUCED_MS : DURATION_MS));

    return () => {
      timers.forEach((t) => clearTimeout(t));
      document.body.classList.remove("goal-shake");
    };
  }, [goal.id, onDone, colors]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden">
      {/* destello de fondo con el color del equipo */}
      <div
        className="goal-flash absolute inset-0"
        style={{ background: `radial-gradient(circle, ${accent}55, transparent 70%)` }}
      />

      {/* pelota que viene hacia la pantalla */}
      <div
        className="goal-ball absolute left-1/2 top-1/2"
        style={{ width: "42vmin", height: "42vmin" }}
      >
        <SoccerBall />
      </div>

      {/* GOOOL con letras animadas */}
      <div
        className="relative flex"
        style={{ filter: `drop-shadow(0 6px 18px ${accent})` }}
      >
        {"GOOOL".split("").map((ch, i) => (
          <span
            key={i}
            className="goool-letter text-6xl font-black tracking-tight sm:text-8xl"
            style={{
              color: "#ffffff",
              WebkitTextStroke: `2px ${accent}`,
              animationDelay: `${i * 70}ms`,
            }}
          >
            {ch}
          </span>
        ))}
      </div>

      {/* contexto: banderas + nuevo marcador */}
      <div className="goal-context relative mt-6 flex items-center gap-2 rounded-full bg-neutral-950/80 px-4 py-2 text-lg font-bold text-neutral-100 ring-1 ring-white/10">
        <Flag team={goal.homeTeam} />
        <span className="tabular-nums">
          {goal.homeScore} – {goal.awayScore}
        </span>
        <Flag team={goal.awayTeam} />
        <span className="ml-1 hidden text-sm font-medium text-neutral-400 sm:inline">
          {toSpanish(scorer)}
        </span>
      </div>
    </div>
  );
}
