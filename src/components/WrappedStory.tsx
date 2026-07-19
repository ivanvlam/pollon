"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import confetti from "canvas-confetti";
import { toast } from "sonner";

import { Flag } from "@/components/Flag";
import { shareText, type BestPrediction, type WrappedData } from "@/lib/wrapped";

// ============================================================
// Pollon Wrapped — resumen de fin de torneo tipo "stories"
// ============================================================
// Overlay a pantalla completa con slides que se avanzan tocando (tercio
// izquierdo = atrás, resto = siguiente), flechas del teclado o swipe. Confeti
// en los slides "épicos" (personaje y ganador). Puramente cliente: recibe el
// payload ya calculado por la página server (`WrappedData`).

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Ráfaga de confeti desde ambos lados. */
function burst() {
  if (prefersReducedMotion()) return;
  const colors = ["#22c55e", "#eab308", "#ffffff", "#38bdf8"];
  const fire = (x: number, angle: number) =>
    confetti({
      particleCount: 70,
      spread: 70,
      startVelocity: 45,
      angle,
      origin: { x, y: 0.7 },
      colors,
      scalar: 1.1,
      zIndex: 200,
      disableForReducedMotion: true,
    });
  fire(0.1, 60);
  fire(0.9, 120);
  window.setTimeout(() => fire(0.5, 90), 250);
  window.setTimeout(() => {
    fire(0.2, 65);
    fire(0.8, 115);
  }, 700);
}

// Cada slide define su gradiente de fondo para dar variedad tipo Wrapped.
type SlideKind =
  | "intro"
  | "points"
  | "rank"
  | "breakdown"
  | "best"
  | "game"
  | "specials"
  | "persona"
  | "winner"
  | "thanks";

interface Slide {
  kind: SlideKind;
  bg: string;
}

function buildSlides(d: WrappedData): Slide[] {
  const slides: Slide[] = [
    { kind: "intro", bg: "from-emerald-600 via-emerald-800 to-neutral-950" },
    { kind: "points", bg: "from-violet-600 via-violet-900 to-neutral-950" },
  ];
  if (d.rank !== null) {
    slides.push({ kind: "rank", bg: "from-amber-500 via-orange-800 to-neutral-950" });
  }
  slides.push({ kind: "breakdown", bg: "from-sky-600 via-sky-900 to-neutral-950" });
  if (d.bestPrediction) {
    slides.push({ kind: "best", bg: "from-rose-600 via-rose-900 to-neutral-950" });
  }
  if (d.predictionCount > 0) {
    slides.push({ kind: "game", bg: "from-teal-600 via-teal-900 to-neutral-950" });
  }
  if (d.champion || d.topScorer) {
    slides.push({ kind: "specials", bg: "from-fuchsia-600 via-fuchsia-900 to-neutral-950" });
  }
  slides.push({ kind: "persona", bg: "from-indigo-600 via-indigo-900 to-neutral-950" });
  slides.push({ kind: "winner", bg: "from-yellow-500 via-amber-700 to-neutral-950" });
  slides.push({ kind: "thanks", bg: "from-emerald-600 via-emerald-900 to-neutral-950" });
  return slides;
}

const fmtPct = (n: number) => `${Math.round(n * 100)}%`;

/** Redondea hacia abajo a un hito "redondo" (ej. 1743 → 1700) para mostrar
 *  "+N": el "+" queda siempre honesto (nunca infla el número real). */
const roundDownNice = (n: number, step: number) => Math.floor(n / step) * step;
const plusRounded = (n: number, step: number) =>
  n >= step ? `+${roundDownNice(n, step)}` : `${n}`;

/** Extrae el id de la polla de la URL actual (…/pool/<id>/wrapped). */
function poolIdFromUrl(): string {
  if (typeof window === "undefined") return "";
  const m = window.location.pathname.match(/\/pool\/([^/]+)/);
  return m?.[1] ?? "";
}

export function WrappedStory({ data }: { data: WrappedData }) {
  const router = useRouter();
  const slides = useRef(buildSlides(data)).current;
  const [i, setI] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const last = slides.length - 1;
  const slide = slides[i]!;

  const next = useCallback(() => setI((p) => Math.min(p + 1, last)), [last]);
  const prev = useCallback(() => setI((p) => Math.max(p - 1, 0)), []);

  // Evita que un doble-tap accidental (o clicks muy seguidos) salte de a dos
  // slides: ignora navegaciones por gesto dentro de una ventana corta.
  const lastNav = useRef(0);
  const navGuard = () => {
    const now = Date.now();
    if (now - lastNav.current < 250) return false;
    lastNav.current = now;
    return true;
  };
  const exit = useCallback(
    () => router.push(`/pool/${poolIdFromUrl()}`),
    [router],
  );

  // Confeti en los slides épicos.
  useEffect(() => {
    if (slide.kind === "persona" || slide.kind === "winner" || slide.kind === "thanks") burst();
  }, [slide.kind]);

  // Teclado: ← → y Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, exit]);

  const share = async () => {
    const text = shareText(data);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Pollon Wrapped", text });
        return;
      }
    } catch {
      // usuario canceló el share nativo → no hacemos nada
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Resumen copiado. ¡Pégalo donde quieras!");
    } catch {
      toast.error("No se pudo copiar el resumen.");
    }
  };

  // Un solo click handler: el tercio izquierdo retrocede, el resto avanza. Los
  // botones internos hacen stopPropagation para no disparar la navegación.
  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!navGuard()) return;
    const x = e.clientX;
    if (x < window.innerWidth / 3) prev();
    else next();
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex touch-none cursor-pointer select-none flex-col overflow-hidden bg-gradient-to-b ${slide.bg} text-white transition-[background-color] duration-500`}
      onClick={onTap}
      onTouchStart={(e) => (touchStartX.current = e.touches[0]!.clientX)}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        if (start === null) return;
        const dx = e.changedTouches[0]!.clientX - start;
        if (Math.abs(dx) > 40 && navGuard()) {
          if (dx < 0) next();
          else prev();
        }
        touchStartX.current = null;
      }}
    >
      <StoryStyles />

      {/* Barras de progreso segmentadas */}
      <div className="flex gap-1.5 px-3 pb-1 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {slides.map((_, idx) => (
          <div key={idx} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white transition-all duration-300"
              style={{ width: idx <= i ? "100%" : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-2 text-sm">
        <span className="font-semibold tracking-wide opacity-90">🐔 Pollon Wrapped</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            exit();
          }}
          className="rounded-full bg-black/25 px-3 py-1 text-xs font-medium ring-1 ring-white/20 transition hover:bg-black/40"
          aria-label="Cerrar resumen"
        >
          ✕ Salir
        </button>
      </div>

      {/* Contenido del slide (key=i re-monta para re-disparar la animación) */}
      <div
        key={i}
        className="wrapped-slide relative flex flex-1 flex-col items-center justify-center px-6 text-center"
      >
        <SlideContent data={data} kind={slide.kind} onShare={share} onRestart={() => setI(0)} />
      </div>

      {/* Pista de navegación */}
      {i < last && (
        <p className="pointer-events-none pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-white/60">
          Toca para continuar →
        </p>
      )}
    </div>
  );
}

// ── Contenido por slide ──────────────────────────────────────────────────────
function SlideContent({
  data,
  kind,
  onShare,
  onRestart,
}: {
  data: WrappedData;
  kind: SlideKind;
  onShare: () => void;
  onRestart: () => void;
}) {
  switch (kind) {
    case "intro":
      return (
        <>
          <p className="anim-1 text-lg font-medium text-white/80">Tu Mundial 2026</p>
          <h1 className="anim-2 mt-2 text-balance text-4xl font-black leading-tight sm:text-5xl">
            {data.poolName}
          </h1>
          <p className="anim-3 mt-6 max-w-xs text-white/80">
            {data.displayName}, esto es lo que hiciste en el torneo. Vamos slide por slide.
          </p>
          <p className="anim-4 mt-10 text-sm text-white/60">Toca para empezar →</p>
        </>
      );

    case "points": {
      const aboveAvg = data.total >= data.poolAvgPoints;
      return (
        <>
          <p className="anim-1 text-lg font-medium text-white/80">Sumaste en total</p>
          <div className="anim-2 mt-3 text-8xl font-black tabular-nums drop-shadow-lg sm:text-9xl">
            {data.total}
          </div>
          <p className="anim-3 mt-2 text-2xl font-bold">puntos</p>
          {data.predictionCount > 0 && (
            <p className="anim-3 mt-1 text-sm text-white/70">
              ≈ {data.avgPerPredicted.toFixed(1)} por partido predicho
            </p>
          )}
          <div className="anim-4 mt-8 flex w-full max-w-xs gap-3">
            <MiniStat label="Promedio polla" value={data.poolAvgPoints.toFixed(0)} />
            <MiniStat label="Líder" value={`${data.topPoints}`} />
          </div>
          <p className="anim-4 mt-5 max-w-xs font-medium text-white/85">
            {data.memberCount <= 1
              ? "Cada acierto contó. Así se construye una campaña mundialista."
              : aboveAvg
                ? "Terminaste por encima del promedio de la polla. 💪"
                : "Cada acierto contó. La próxima vas por más."}
          </p>
        </>
      );
    }

    case "rank":
      return (
        <>
          <p className="anim-1 text-lg font-medium text-white/80">Terminaste en el puesto</p>
          <div className="anim-2 mt-3 flex items-baseline justify-center gap-2">
            <span className="text-8xl font-black tabular-nums drop-shadow-lg sm:text-9xl">
              {data.tied ? "=" : ""}
              {data.rank}
              <span className="align-top text-4xl">°</span>
            </span>
          </div>
          <p className="anim-3 mt-2 text-xl font-semibold">
            de {data.memberCount} {data.memberCount === 1 ? "jugador" : "jugadores"}
          </p>
          {data.rank === 1 && <p className="anim-4 mt-6 text-2xl font-black">🥇 ¡En la cima!</p>}
          {data.rank === 2 && <p className="anim-4 mt-6 text-2xl font-black">🥈 Subcampeón</p>}
          {data.rank === 3 && <p className="anim-4 mt-6 text-2xl font-black">🥉 En el podio</p>}
          <div className="anim-4 mt-6 max-w-xs space-y-1 text-white/80">
            {data.rank === 1 ? (
              <p>Nadie te pasó: lideraste la polla. 👑</p>
            ) : (
              <p>
                A <b className="text-white">{data.pointsBehindLeader}</b> pts del líder.
              </p>
            )}
            {data.beatCount > 0 && (
              <p>
                Quedaste por delante de <b className="text-white">{data.beatCount}</b>{" "}
                {data.beatCount === 1 ? "jugador" : "jugadores"}.
              </p>
            )}
          </div>
        </>
      );

    case "breakdown": {
      const exactPts = data.exactCount * 5;
      const diffPts = data.diffCount * 3;
      const winPts = data.winnerCount * 2;
      const strongest = Math.max(exactPts, diffPts, winPts);
      const suit =
        strongest === 0
          ? null
          : exactPts === strongest
            ? "Tu fuerte fueron los marcadores exactos. 🎯"
            : diffPts === strongest
              ? "Tu fuerte fue clavar la diferencia de goles. 📏"
              : "Tu fuerte fue leer al ganador. ✅";
      return (
        <>
          <p className="anim-1 text-lg font-medium text-white/80">Cómo lo lograste</p>
          <div className="anim-2 mt-6 grid w-full max-w-xs grid-cols-1 gap-3">
            <StatRow emoji="🎯" label="Marcadores exactos" value={data.exactCount} sub="5 pts c/u" />
            <StatRow emoji="📏" label="Misma diferencia" value={data.diffCount} sub="3 pts c/u" />
            <StatRow emoji="✅" label="Solo el ganador" value={data.winnerCount} sub="2 pts c/u" />
            <StatRow emoji="📝" label="Partidos predichos" value={data.predictionCount} />
          </div>
          {suit && <p className="anim-4 mt-5 max-w-xs font-medium text-white/85">{suit}</p>}
        </>
      );
    }

    case "best":
      return (
        <>
          <p className="anim-1 text-lg font-medium text-white/80">Tu mejor pálpito</p>
          {data.bestPrediction && (
            <BestSlide bp={data.bestPrediction} memberCount={data.memberCount} />
          )}
        </>
      );

    case "game":
      return (
        <>
          <p className="anim-1 text-lg font-medium text-white/80">Tu nivel de juego</p>
          <div className="anim-2 mt-6 grid w-full max-w-xs grid-cols-1 gap-3">
            <StatRow emoji="🔥" label="Mejor racha" value={`${data.longestStreak}`} />
            <StatRow emoji="🎯" label="% de acierto" value={fmtPct(data.accuracy)} />
            <StatRow
              emoji="📈"
              label="Promedio por partido"
              value={data.avgPerPredicted.toFixed(1)}
            />
          </div>
          {data.longestStreak >= 3 && (
            <p className="anim-3 mt-6 max-w-xs text-white/75">
              ¡{data.longestStreak} partidos seguidos sumando! Estabas encendido.
            </p>
          )}
        </>
      );

    case "specials":
      return (
        <>
          <p className="anim-1 text-lg font-medium text-white/80">Tus apuestas grandes</p>
          <p className="anim-1 mt-1 max-w-xs text-sm text-white/60">
            Campeón (+15) y goleador (+10): las jugadas que definen el torneo.
          </p>
          <div className="anim-2 mt-5 flex w-full max-w-xs flex-col gap-3">
            {data.champion && (
              <SpecialCard
                emoji="🏆"
                label="Campeón"
                pick={data.champion.pick}
                correct={data.champion.correct}
                points={data.champion.points}
              />
            )}
            {data.topScorer && (
              <SpecialCard
                emoji="⚽"
                label="Goleador"
                pick={data.topScorer.pick}
                correct={data.topScorer.correct}
                points={data.topScorer.points}
              />
            )}
          </div>
          {(() => {
            const bonus =
              (data.champion?.points ?? 0) + (data.topScorer?.points ?? 0);
            return (
              <p className="anim-4 mt-5 max-w-xs font-medium text-white/85">
                {bonus > 0
                  ? `Te sumaron ${bonus} puntos extra. 🔥`
                  : "No cayeron esta vez, pero el riesgo es parte del juego."}
              </p>
            );
          })()}
        </>
      );

    case "persona":
      return (
        <>
          <p className="anim-1 text-lg font-medium text-white/80">Tu personaje del Mundial</p>
          <div className="anim-2 mt-4 text-7xl drop-shadow-lg sm:text-8xl">
            {data.persona.emoji}
          </div>
          <h2 className="anim-3 mt-4 text-4xl font-black sm:text-5xl">{data.persona.title}</h2>
          <p className="anim-4 mt-4 max-w-xs text-white/85">{data.persona.blurb}</p>
          <div className="anim-4 mt-6 flex w-full max-w-xs gap-3">
            <MiniStat label="Exactos" value={`${data.exactCount}`} />
            <MiniStat label="Acierto" value={fmtPct(data.accuracy)} />
            <MiniStat label="Racha" value={`${data.longestStreak}`} />
          </div>
        </>
      );

    case "winner":
      return (
        <>
          <p className="anim-1 text-lg font-medium text-white/80">
            {data.tournamentFinished ? "Campeón de la polla" : "Líder de la polla"}
          </p>
          <div className="anim-2 mt-3 text-7xl drop-shadow-lg">👑</div>
          <h2 className="anim-3 mt-3 text-balance text-4xl font-black sm:text-5xl">
            {data.poolWinner ? data.poolWinner.name : "Aún por definir"}
          </h2>
          {data.poolWinner?.isMe && (
            <p className="anim-3 mt-2 text-xl font-bold text-emerald-300">¡Eres tú! 🎉</p>
          )}
          {!data.tournamentFinished && (
            <p className="anim-4 mt-3 text-sm text-white/70">
              El torneo sigue: vuelve al terminar la final para el veredicto final.
            </p>
          )}
        </>
      );

    case "thanks":
      return (
        <>
          <div className="anim-1 text-6xl drop-shadow-lg sm:text-7xl">🐔</div>
          <h2 className="anim-2 mt-4 text-balance text-3xl font-black sm:text-4xl">
            Gracias por ser parte
          </h2>
          <p className="anim-2 mt-3 max-w-xs text-white/85">
            Pollon nació para vivir el Mundial entre amigos. Esto hicimos juntos:
          </p>
          <div className="anim-3 mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
            <MiniStat
              label="Predicciones"
              value={plusRounded(data.projectStats.predictions, 100)}
            />
            <MiniStat label="Jugadores" value={`+${data.projectStats.users}`} />
            <MiniStat label="Pollas" value={`${data.projectStats.pools}`} />
            <MiniStat label="Partidos" value={`${data.projectStats.matchesFinished}`} />
          </div>
          <p className="anim-4 mt-5 max-w-xs text-sm text-white/70">
            Nos vemos en la próxima. ⚽
          </p>

          <div className="anim-4 mt-6 flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
              className="rounded-full bg-white px-6 py-3 text-base font-bold text-neutral-900 shadow-lg transition active:scale-95"
            >
              📲 Compartir mi Wrapped
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRestart();
              }}
              className="rounded-full bg-black/25 px-5 py-2 text-sm font-medium ring-1 ring-white/20 transition hover:bg-black/40"
            >
              ↺ Ver de nuevo
            </button>
          </div>
        </>
      );
  }
}

/** Slide del mejor pálpito: destaca el acierto más diferenciador con el
 *  contexto, la fecha y cuánto mejor le fue que al resto de la polla. */
function BestSlide({ bp, memberCount }: { bp: BestPrediction; memberCount: number }) {
  const hasOthers = memberCount > 1;
  const solo = hasOthers && bp.alsoNailed === 0;
  return (
    <div className="anim-2 mt-5 w-full max-w-xs rounded-2xl bg-black/25 p-5 ring-1 ring-white/15">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-white/60">
        <span>{bp.context}</span>
        <span>{bp.date}</span>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-lg font-bold">
        <Flag team={bp.homeTeam} />
        <span className="tabular-nums">{bp.finalScore}</span>
        <Flag team={bp.awayTeam} />
      </div>
      <p className="mt-3 text-sm text-white/80">
        Predijiste <b className="tabular-nums">{bp.predictedScore}</b> · {bp.reasonLabel}
      </p>
      <p className="mt-3 text-3xl font-black text-emerald-300">+{bp.points} pts</p>

      {hasOthers && (
        <div className="mt-4 border-t border-white/10 pt-3 text-sm">
          {solo ? (
            <p className="font-semibold text-yellow-300">
              🎯 {bp.isExact ? "¡Nadie más lo clavó!" : "¡Nadie más lo acertó!"}
            </p>
          ) : (
            <p className="text-white/80">
              Tú y {bp.alsoNailed} más lo {bp.isExact ? "clavaron" : "acertaron"}
            </p>
          )}
          <p className="mt-1 text-white/60">
            El resto de la polla promedió{" "}
            <b className="tabular-nums text-white/80">{bp.othersAvg.toFixed(1)}</b> pts aquí
          </p>
        </div>
      )}
    </div>
  );
}

function StatRow({
  emoji,
  label,
  value,
  sub,
}: {
  emoji: string;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-black/20 px-4 py-3 ring-1 ring-white/10">
      <span className="flex items-center gap-2 text-sm text-white/85">
        <span className="text-lg">{emoji}</span>
        <span className="flex flex-col text-left">
          {label}
          {sub && <span className="text-xs text-white/45">{sub}</span>}
        </span>
      </span>
      <span className="text-2xl font-black tabular-nums">{value}</span>
    </div>
  );
}

/** Chip compacto para pares etiqueta/valor (comparaciones). */
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-xl bg-black/20 px-3 py-2 ring-1 ring-white/10">
      <span className="text-2xl font-black tabular-nums">{value}</span>
      <span className="text-xs text-white/60">{label}</span>
    </div>
  );
}

function SpecialCard({
  emoji,
  label,
  pick,
  correct,
  points,
}: {
  emoji: string;
  label: string;
  pick: string | null;
  correct: boolean;
  points: number;
}) {
  return (
    <div
      className={`rounded-xl px-4 py-3 text-left ring-1 ${
        correct ? "bg-emerald-500/25 ring-emerald-300/40" : "bg-black/20 ring-white/10"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
          <span className="text-base">{emoji}</span>
          {label}
        </span>
        {correct && (
          <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-xs font-bold text-emerald-950">
            +{points} ✓
          </span>
        )}
      </div>
      <p className="mt-1 text-lg font-bold">{pick ?? "No elegiste"}</p>
    </div>
  );
}

/** Animaciones de entrada escalonadas por slide (se re-disparan con key=i). */
function StoryStyles() {
  return (
    <style>{`
      @keyframes wrapped-rise {
        from { opacity: 0; transform: translate3d(0, 18px, 0); }
        to   { opacity: 1; transform: translate3d(0, 0, 0); }
      }
      .wrapped-slide .anim-1,
      .wrapped-slide .anim-2,
      .wrapped-slide .anim-3,
      .wrapped-slide .anim-4 {
        opacity: 0;
        animation: wrapped-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
      }
      .wrapped-slide .anim-1 { animation-delay: 0.05s; }
      .wrapped-slide .anim-2 { animation-delay: 0.20s; }
      .wrapped-slide .anim-3 { animation-delay: 0.38s; }
      .wrapped-slide .anim-4 { animation-delay: 0.56s; }
      @media (prefers-reduced-motion: reduce) {
        .wrapped-slide .anim-1,
        .wrapped-slide .anim-2,
        .wrapped-slide .anim-3,
        .wrapped-slide .anim-4 {
          animation: none;
          opacity: 1;
        }
      }
    `}</style>
  );
}
