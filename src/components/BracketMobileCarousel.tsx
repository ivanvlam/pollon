"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface RoundView {
  /** Etiqueta corta para la pestaña (ej. "16avos"). */
  tab: string;
  content: ReactNode;
}

/**
 * Carrusel mobile del bracket: una ronda por pantalla, swipe horizontal con
 * snap. La navegación horizontal es explícita vía una barra de pestañas que
 * resalta la ronda activa y permite saltar tocándola. Lo vertical NO es sticky:
 * el contenido de cada ronda scrollea naturalmente dentro del carrusel.
 */
export function BracketMobileCarousel({ rounds }: { rounds: RoundView[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(0);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.min(rounds.length - 1, Math.max(0, idx)));
  };

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  // Mantener la pestaña activa visible si la barra desborda.
  useEffect(() => {
    tabRefs.current[active]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {/* Pestañas de ronda: navegación horizontal explícita */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Rondas">
        {rounds.map((r, i) => (
          <button
            key={i}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active === i}
            onClick={() => goTo(i)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              active === i
                ? "border-emerald-600 bg-emerald-500/15 text-emerald-400"
                : "border-neutral-800 bg-neutral-900/40 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {r.tab}
          </button>
        ))}
      </div>

      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-auto"
        style={{ maxHeight: "72vh", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
      >
        {rounds.map((r, i) => (
          <section key={i} className="flex w-full shrink-0 snap-start flex-col px-0.5">
            {r.content}
          </section>
        ))}
      </div>
    </div>
  );
}
