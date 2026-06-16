"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CarIcon } from "@/components/CarIcon";
import { Flag } from "@/components/Flag";
import type { ChartMember, HistoryPoint } from "@/components/RankingHistoryChart";
import { buttonClasses } from "@/components/ui/Button";
import { buildColorMap, CHART_COLORS } from "@/lib/chart-colors";
import { cn } from "@/lib/cn";
import { computeRaceFrames, type RaceData, type RaceFrame } from "@/lib/race";
import { toSpanish } from "@/lib/teamNames";

/** Frame de display: los frames de partido más un frame inicial de "Salida". */
type DisplayFrame = RaceFrame & { isStart?: boolean };

interface Props {
  history: HistoryPoint[];
  members: ChartMember[];
  poolId: string;
  totalMatches: number;
}

const BASE_MS_PER_FRAME = 650;
const SPEEDS = [1, 2, 4] as const;

// Bandera a cuadros de la meta (patrón CSS, tonos neutros — no es un acento).
const CHECKER: React.CSSProperties = {
  backgroundImage:
    "conic-gradient(#e5e5e5 90deg, #171717 90deg 180deg, #e5e5e5 180deg 270deg, #171717 270deg)",
  backgroundSize: "6px 6px",
};

/** Detecta `prefers-reduced-motion` para saltar countdown y animación. */
function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mq.matches);
    const onChange = () => setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduce;
}

export function RankingRaceChart({ history, members, totalMatches }: Props) {
  const reduceMotion = usePrefersReducedMotion();

  const race = useMemo<RaceData>(
    () =>
      computeRaceFrames({
        history: history.map((h) => ({
          homeTeam: h.homeTeam,
          awayTeam: h.awayTeam,
          homeScore: h.homeScore,
          awayScore: h.awayScore,
          kickoffAt: h.kickoffAt,
          cumulativePoints: h.cumulativePoints,
          pointsEarned: h.pointsEarned,
        })),
        members: members.map((m) => ({ id: m.id, name: m.name })),
        totalMatches,
      }),
    [history, members, totalMatches],
  );

  // Frames de display: un frame de "Salida" (todos en 0, línea de largada) y
  // luego los partidos. Así la carrera arranca con todos parejos y largan al
  // primer partido del Mundial.
  const frames = useMemo<DisplayFrame[]>(() => {
    const start: DisplayFrame = {
      isStart: true,
      played: 0,
      homeTeam: "",
      awayTeam: "",
      homeScore: null,
      awayScore: null,
      kickoffAt: "",
      cars: members.map((m) => ({ userId: m.id, x: 0, points: 0, gained: 0, rank: 1 })),
    };
    return [start, ...race.frames];
  }, [race, members]);
  const total = frames.length;

  const colorMap = useMemo(() => buildColorMap(members.map((m) => m.id)), [members]);
  const colorOf = useCallback(
    (id: string) => colorMap.get(id) ?? CHART_COLORS[0]!,
    [colorMap],
  );

  // Carriles ordenados por posición final (rank en el último partido).
  const lanes = useMemo(() => {
    const last = race.frames[race.frames.length - 1];
    const rankOf = new Map(last ? last.cars.map((c) => [c.userId, c.rank]) : []);
    return [...members].sort(
      (a, b) => (rankOf.get(a.id) ?? 999) - (rankOf.get(b.id) ?? 999),
    );
  }, [race, members]);

  const [phase, setPhase] = useState<"countdown" | "racing" | "finished">("countdown");
  const [countdownNum, setCountdownNum] = useState(3);
  const [frame, setFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);

  const frameRef = useRef(0);
  const accumRef = useRef(0);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef(1);
  speedRef.current = speed;

  const play = useCallback(() => {
    playingRef.current = true;
    lastRef.current = 0;
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    playingRef.current = false;
    setIsPlaying(false);
  }, []);

  // Movimiento: avanza frameRef con un acumulador en rAF; el tween suave entre
  // posiciones lo da la transición CSS de cada auto.
  const tick = useCallback(
    (t: number) => {
      if (!playingRef.current) {
        lastRef.current = 0;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      if (lastRef.current === 0) lastRef.current = t;
      const dt = t - lastRef.current;
      lastRef.current = t;
      accumRef.current += dt / (BASE_MS_PER_FRAME / speedRef.current);

      let advanced = false;
      while (accumRef.current >= 1 && frameRef.current < total - 1) {
        accumRef.current -= 1;
        frameRef.current += 1;
        advanced = true;
      }
      if (frameRef.current >= total - 1) {
        frameRef.current = total - 1;
        accumRef.current = 0;
        playingRef.current = false;
        setIsPlaying(false);
        setPhase("finished");
      }
      if (advanced) setFrame(frameRef.current);
      rafRef.current = requestAnimationFrame(tick);
    },
    [total],
  );

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  // Reduced motion: salta directo al estado final, sin countdown ni animación.
  useEffect(() => {
    if (!reduceMotion) return;
    frameRef.current = total - 1;
    setFrame(total - 1);
    setPhase("finished");
  }, [reduceMotion, total]);

  // Countdown 3·2·1·GO al entrar; al terminar arranca la carrera.
  useEffect(() => {
    if (reduceMotion || phase !== "countdown") return;
    setCountdownNum(3);
    const timers = [
      setTimeout(() => setCountdownNum(2), 800),
      setTimeout(() => setCountdownNum(1), 1600),
      setTimeout(() => setCountdownNum(0), 2400), // GO
      setTimeout(() => {
        setPhase("racing");
        play();
      }, 3100),
    ];
    return () => timers.forEach(clearTimeout);
  }, [phase, reduceMotion, play]);

  const handleRestart = useCallback(() => {
    frameRef.current = 0;
    accumRef.current = 0;
    setFrame(0);
    pause();
    if (reduceMotion) {
      frameRef.current = total - 1;
      setFrame(total - 1);
      setPhase("finished");
      return;
    }
    setPhase("countdown"); // re-dispara el countdown 3·2·1·GO
  }, [pause, reduceMotion, total]);

  const handlePlayPause = useCallback(() => {
    if (frameRef.current >= total - 1) {
      handleRestart(); // al final, repetir desde el principio con countdown
      return;
    }
    if (playingRef.current) pause();
    else play();
  }, [total, play, pause, handleRestart]);

  const handleScrub = useCallback(
    (value: number) => {
      pause();
      frameRef.current = value;
      accumRef.current = 0;
      setFrame(value);
      setPhase(value >= total - 1 ? "finished" : "racing");
    },
    [pause, total],
  );

  if (total === 0) return null;

  const current = frames[Math.min(frame, total - 1)]!;
  const carMap = new Map(current.cars.map((c) => [c.userId, c]));
  const stepMs = isPlaying && !reduceMotion ? BASE_MS_PER_FRAME / speed : 140;
  const showCountdown = phase === "countdown" && !reduceMotion;

  return (
    <div className="flex flex-col gap-3">
      {/* Cabecera: partido actual + contador X / total */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2">
        {current.isStart ? (
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-sm font-semibold text-neutral-100">Salida</span>
            <span className="hidden text-sm text-neutral-400 sm:inline">en la línea de largada</span>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2">
            <Flag team={current.homeTeam} className="shrink-0" />
            <span className="shrink-0 tabular-nums text-sm font-semibold text-neutral-100">
              {current.homeScore ?? "–"}&nbsp;–&nbsp;{current.awayScore ?? "–"}
            </span>
            <Flag team={current.awayTeam} className="shrink-0" />
            <span className="hidden truncate text-sm text-neutral-400 sm:inline">
              {toSpanish(current.homeTeam)} vs {toSpanish(current.awayTeam)}
            </span>
          </div>
        )}
        <div className="shrink-0 whitespace-nowrap tabular-nums text-xs text-neutral-400 sm:text-sm">
          <span className="font-semibold text-neutral-100">{current.played}</span>/{totalMatches}{" "}
          partidos jugados
        </div>
      </div>

      {/* Pista */}
      <div className="relative overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950 p-3">
        <div className="flex min-w-[22rem] flex-col gap-1.5">
          {lanes.map((m) => {
            const car = carMap.get(m.id);
            const x = car ? car.x : 0;
            const color = colorOf(m.id);
            const isLeader = car?.rank === 1;
            return (
              <div key={m.id} className="flex items-center gap-2">
                {/* Etiqueta: nombre (color) + puntos actuales */}
                <div className="w-24 shrink-0 sm:w-36">
                  <p
                    className={cn(
                      "truncate text-xs sm:text-sm",
                      isLeader ? "font-semibold" : "font-medium",
                    )}
                    style={{ color }}
                  >
                    {m.name}
                  </p>
                  <p className="tabular-nums text-[11px] text-neutral-500">
                    {car?.points ?? 0} pts
                  </p>
                </div>

                {/* Carril (pista de asfalto) */}
                <div className="relative h-9 flex-1 rounded bg-neutral-900/40">
                  {/* Línea central discontinua */}
                  <div className="pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 border-t border-dashed border-neutral-600/60" />
                  {/* Línea de largada */}
                  <div className="pointer-events-none absolute bottom-1 left-0 top-1 w-px bg-neutral-500/70" />

                  <div
                    className="absolute bottom-0 top-0 my-auto h-7 w-10"
                    style={{
                      left: `${x * 100}%`,
                      transform: "translateX(-50%)",
                      transitionProperty: "left",
                      transitionDuration: `${stepMs}ms`,
                      transitionTimingFunction: "linear",
                    }}
                  >
                    <CarIcon color={color} className="h-full w-full" />
                    {/* Badge "+N" cuando suma en este partido */}
                    {car && car.gained > 0 && (
                      <span
                        key={frame}
                        className="race-pop absolute left-1/2 top-0 whitespace-nowrap text-xs font-bold tabular-nums text-emerald-400"
                      >
                        +{car.gained}
                      </span>
                    )}
                  </div>

                  {/* Línea de meta a cuadros */}
                  <div
                    className="pointer-events-none absolute bottom-0 right-0 top-0 w-1.5 rounded-sm"
                    style={CHECKER}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Overlay del countdown */}
        {showCountdown && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/70 backdrop-blur-[1px]">
            <span
              key={countdownNum}
              className={cn(
                "race-count font-black tabular-nums",
                countdownNum > 0
                  ? "text-6xl text-neutral-100 sm:text-7xl"
                  : "text-5xl text-emerald-400 sm:text-6xl",
              )}
            >
              {countdownNum > 0 ? countdownNum : "¡GO!"}
            </span>
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePlayPause}
          className={buttonClasses("secondary", "sm")}
          disabled={showCountdown}
        >
          {isPlaying ? "Pausa" : frame >= total - 1 ? "Repetir" : "Play"}
        </button>
        <button
          type="button"
          onClick={handleRestart}
          className={buttonClasses("ghost", "sm")}
          disabled={showCountdown}
        >
          Reiniciar
        </button>

        <div className="ml-auto flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm font-semibold tabular-nums transition",
                s === speed
                  ? "bg-emerald-500 text-neutral-950"
                  : "text-neutral-400 hover:text-neutral-100",
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={Math.max(total - 1, 0)}
        value={Math.min(frame, total - 1)}
        onChange={(e) => handleScrub(Number(e.target.value))}
        aria-label="Avance de la carrera"
        className="w-full accent-emerald-500"
        disabled={showCountdown}
      />

      <p className="text-center text-xs text-neutral-500">
        La meta (línea a cuadros) está en los {totalMatches} partidos del Mundial.
      </p>
    </div>
  );
}
