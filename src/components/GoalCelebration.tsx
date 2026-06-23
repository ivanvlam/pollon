"use client";

import { useEffect, useRef, useState } from "react";

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

const GOAL_SOUND_SRC = "/sounds/goal.mp3";
const MUTE_KEY = "pollon:goal-sound-muted";

/** La animación visual aparece este tiempo después de que arranca el audio. */
const AUDIO_LEAD_MS = 4000;
/**
 * Cierre de respaldo si el audio no llega a reproducir (autoplay bloqueado) y
 * por ende nunca emite "ended". Algo mayor a la duración del audio (~10s).
 */
const FALLBACK_TOTAL_MS = 12000;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function readMuted(): boolean {
  return (
    typeof window !== "undefined" &&
    window.localStorage.getItem(MUTE_KEY) === "1"
  );
}

/** Pelota de fútbol estilizada (SVG, nítida a cualquier tamaño). */
const C = 50; // centro
const CENTER_R = 15; // radio del pentágono central
const OUTER_DIST = 40; // distancia del centro a los pentágonos del borde
const OUTER_R = 13; // radio de los pentágonos del borde

/** Puntos de un pentágono (un vértice apuntando según `rotDeg`). */
function pentagon(cx: number, cy: number, r: number, rotDeg: number): string {
  return Array.from({ length: 5 }, (_, k) => {
    const a = ((-90 + rotDeg + k * 72) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

const SoccerBall = () => {
  // Vértices del pentágono central: de cada uno sale una costura radial hacia
  // un pentágono del borde (recortado por el círculo).
  const centerVerts = Array.from({ length: 5 }, (_, k) => {
    const a = ((-90 + k * 72) * Math.PI) / 180;
    return [C + CENTER_R * Math.cos(a), C + CENTER_R * Math.sin(a)] as const;
  });
  const outer = Array.from({ length: 5 }, (_, k) => {
    const a = ((-90 + k * 72) * Math.PI) / 180;
    return {
      cx: C + OUTER_DIST * Math.cos(a),
      cy: C + OUTER_DIST * Math.sin(a),
      rot: 180 + k * 72, // un vértice apuntando hacia el centro
    };
  });

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <defs>
        <clipPath id="goal-ball-clip">
          <circle cx="50" cy="50" r="47" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#111111" strokeWidth="2" />
      <g clipPath="url(#goal-ball-clip)">
        {/* costuras radiales */}
        <g stroke="#111111" strokeWidth="2.5" strokeLinecap="round">
          {centerVerts.map(([x, y], i) => (
            <line key={i} x1={x} y1={y} x2={outer[i]!.cx} y2={outer[i]!.cy} />
          ))}
        </g>
        {/* pentágono central */}
        <polygon points={pentagon(C, C, CENTER_R, 0)} fill="#111111" />
        {/* pentágonos del borde */}
        {outer.map((o, i) => (
          <polygon key={i} points={pentagon(o.cx, o.cy, OUTER_R, o.rot)} fill="#111111" />
        ))}
      </g>
    </svg>
  );
};

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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  // El audio arranca al montar; la animación visual recién aparece a los 4 s.
  const [visualStarted, setVisualStarted] = useState(false);

  // Reproduce el sonido de gol primero. El autoplay puede estar bloqueado si el
  // usuario aún no interactuó con la página; se ignora el rechazo. La animación
  // visual se muestra AUDIO_LEAD_MS después y el overlay se cierra cuando el
  // audio termina (con un respaldo por si el audio no llega a reproducir).
  useEffect(() => {
    const audio = new Audio(GOAL_SOUND_SRC);
    audio.volume = 0.7;
    audio.muted = readMuted();
    audioRef.current = audio;
    setMuted(audio.muted);

    setVisualStarted(false);
    const leadTimer = window.setTimeout(() => setVisualStarted(true), AUDIO_LEAD_MS);
    const fallback = window.setTimeout(onDone, FALLBACK_TOTAL_MS);
    audio.addEventListener("ended", onDone);

    void audio.play().catch(() => {});

    return () => {
      clearTimeout(leadTimer);
      clearTimeout(fallback);
      audio.removeEventListener("ended", onDone);
      audio.pause();
      audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [goal.id, onDone]);

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  };

  useEffect(() => {
    if (!visualStarted || prefersReducedMotion()) return;

    const timers: number[] = [];
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
    timers.push(window.setTimeout(() => { fire(0.3); fire(0.7); }, 1600));
    timers.push(window.setTimeout(() => fire(0.5), 2700));
    timers.push(window.setTimeout(() => { fire(0.2); fire(0.8); }, 3800));
    timers.push(window.setTimeout(() => fire(0.5), 4900));

    return () => {
      timers.forEach((t) => clearTimeout(t));
      document.body.classList.remove("goal-shake");
    };
  }, [visualStarted, colors]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-hidden">
      {/* toggle de sonido (persiste en localStorage); disponible desde que
          arranca el audio, antes de que aparezca la animación */}
      <button
        type="button"
        onClick={toggleMute}
        className="pointer-events-auto absolute right-4 top-4 rounded-full bg-neutral-950/80 px-3 py-2 text-lg ring-1 ring-white/10 transition hover:bg-neutral-800"
        aria-label={muted ? "Activar sonido de gol" : "Silenciar sonido de gol"}
        title={muted ? "Activar sonido de gol" : "Silenciar sonido de gol"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {/* La animación visual recién aparece AUDIO_LEAD_MS después del audio. */}
      {visualStarted && (
        <>
          {/* destello de fondo con el color del equipo */}
          <div
            className="goal-flash absolute inset-0"
            style={{ background: `radial-gradient(circle, ${accent}55, transparent 70%)` }}
          />

          {/* GOOOL con letras animadas (arriba de la pelota) */}
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

          {/* pelota que viene hacia la pantalla, debajo del GOOOL */}
          <div
            className="goal-ball relative my-5"
            style={{ width: "38vmin", height: "38vmin" }}
          >
            <SoccerBall />
          </div>

          {/* contexto: banderas + nuevo marcador */}
          <div className="goal-context relative flex items-center gap-2 rounded-full bg-neutral-950/80 px-4 py-2 text-lg font-bold text-neutral-100 ring-1 ring-white/10">
            <Flag team={goal.homeTeam} />
            <span className="tabular-nums">
              {goal.homeScore} – {goal.awayScore}
            </span>
            <Flag team={goal.awayTeam} />
            <span className="ml-1 hidden text-sm font-medium text-neutral-400 sm:inline">
              {toSpanish(scorer)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
