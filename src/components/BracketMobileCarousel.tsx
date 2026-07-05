"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface RoundView {
  /** Etiqueta corta para la pestaña (ej. "16avos"). */
  tab: string;
  content: ReactNode;
}

/** Tope de altura del contenedor: a partir de aquí, scroll vertical interno. */
const MAX_VH = 0.72;
/** Fracción del ancho que hay que arrastrar para pasar de ronda. */
const SWIPE_RATIO = 0.25;
/** Umbral (px) para decidir el eje del gesto. */
const AXIS_LOCK = 8;

/**
 * Carrusel mobile del bracket: una ronda por "pantalla", como pasar entre
 * pantallas de inicio de un celular. Es un carrusel CONTROLADO —el contenedor
 * no scrollea en horizontal, se desplaza por `transform`— porque en iOS un
 * pager nativo pierde el gesto horizontal cuando cada ronda tiene su propio
 * scroll vertical. El swipe se detecta con bloqueo de eje: un gesto claramente
 * horizontal cambia de ronda; uno vertical scrollea la ronda. La altura es
 * dinámica (mide la ronda activa, tope 72vh) y al cambiar de ronda salta arriba.
 */
export function BracketMobileCarousel({ rounds }: { rounds: RoundView[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);
  const contentRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [width, setWidth] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const last = rounds.length - 1;

  // Fija el alto del contenedor al alto natural de la ronda i, con tope de 72vh.
  const measure = useCallback((i: number) => {
    const content = contentRefs.current[i];
    if (!content) return;
    const cap = Math.round(window.innerHeight * MAX_VH);
    setHeight(Math.min(content.scrollHeight, cap));
  }, []);

  // Ancho del contenedor (para traducir el arrastre a px de desplazamiento).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const read = () => setWidth(el.clientWidth);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Al cambiar de ronda: medir su altura y saltar arriba del todo.
  useLayoutEffect(() => {
    measure(active);
    const page = pageRefs.current[active];
    if (page) page.scrollTop = 0;
  }, [active, measure]);

  // El tope de 72vh depende del viewport: re-medir al rotar / redimensionar.
  useEffect(() => {
    const onResize = () => measure(active);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active, measure]);

  // Mantener la pestaña activa visible si la barra desborda.
  useEffect(() => {
    tabRefs.current[active]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  // Gestos táctiles: swipe horizontal con bloqueo de eje. Listener nativo NO
  // pasivo para poder preventDefault y frenar el scroll mientras se arrastra.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let axis: "h" | "v" | null = null;

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]!;
      startX = t.clientX;
      startY = t.clientY;
      axis = null;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0]!;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (axis === null) {
        if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
        axis = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        if (axis === "h") setDragging(true);
      }
      if (axis === "h") {
        e.preventDefault(); // frena el scroll vertical de la ronda durante el arrastre
        // Resistencia elástica en los extremos.
        const atEdge = (active === 0 && dx > 0) || (active === last && dx < 0);
        setDragX(atEdge ? dx * 0.35 : dx);
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (axis === "h") {
        const dx = (e.changedTouches[0]?.clientX ?? startX) - startX;
        const w = el.clientWidth || 1;
        let next = active;
        if (dx <= -w * SWIPE_RATIO && active < last) next = active + 1;
        else if (dx >= w * SWIPE_RATIO && active > 0) next = active - 1;
        setActive(next);
        setDragX(0);
        setDragging(false);
      }
      axis = null;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [active, last]);

  const goTo = (i: number) => setActive(Math.min(last, Math.max(0, i)));

  const offset = -active * width + dragX;

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {/* Pestañas de ronda: navegación horizontal explícita */}
      <div
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Rondas"
      >
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

      {/* Carrusel controlado: overflow oculto, se mueve por transform. */}
      <div
        ref={containerRef}
        className="relative overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height }}
      >
        <div
          className="flex h-full"
          style={{
            transform: `translate3d(${offset}px, 0, 0)`,
            transition: dragging ? "none" : "transform 300ms ease-out",
          }}
        >
          {rounds.map((r, i) => (
            <section
              key={i}
              ref={(el) => {
                pageRefs.current[i] = el;
              }}
              className="h-full w-full shrink-0 overflow-y-auto px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              <div
                ref={(el) => {
                  contentRefs.current[i] = el;
                }}
              >
                {r.content}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
