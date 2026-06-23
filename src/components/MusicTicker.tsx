"use client";

import { useEffect, useRef, useState } from "react";

import { POLLON_MUSIC, spotifyEmbedUrl, type MusicItem } from "@/lib/music";

/** Velocidad de desplazamiento de la cinta (px/s). Se desacelera al hover. */
const NORMAL_SPEED = 36;
const SLOW_SPEED = 7;

export function MusicTicker() {
  const items = POLLON_MUSIC;

  // Primer ítem que sea de Spotify: con el que arranca el mini-reproductor.
  const firstEmbed =
    items.map((i) => spotifyEmbedUrl(i.url)).find(Boolean) ?? null;
  const [embed, setEmbed] = useState<string | null>(firstEmbed);

  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const speedRef = useRef(NORMAL_SPEED);
  const targetRef = useRef(NORMAL_SPEED);

  // Desplazamiento continuo por rAF (permite desacelerar suave al hover, sin
  // saltos). Respeta prefers-reduced-motion: si está activo, la cinta no se
  // mueve (queda estática y clickeable).
  useEffect(() => {
    if (items.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      speedRef.current += (targetRef.current - speedRef.current) * Math.min(1, dt * 4);
      const track = trackRef.current;
      if (track) {
        const half = track.scrollWidth / 2;
        offsetRef.current += speedRef.current * dt;
        if (half > 0 && offsetRef.current >= half) offsetRef.current -= half;
        track.style.transform = `translateX(${-offsetRef.current}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [items.length]);

  if (items.length === 0) return null;

  const onSelect = (item: MusicItem) => {
    const e = spotifyEmbedUrl(item.url);
    if (e) setEmbed(e);
    else window.open(item.url, "_blank", "noopener,noreferrer");
  };

  // La cinta se renderiza dos veces seguidas para el loop sin costuras.
  const row = (copy: string) =>
    items.map((item, i) => (
      <span key={`${copy}-${i}`} className="flex items-center">
        <button
          type="button"
          onClick={() => onSelect(item)}
          className="whitespace-nowrap px-1 text-lg font-medium text-neutral-300 transition hover:text-emerald-400"
          title={item.artist ? `${item.title} — ${item.artist}` : item.title}
        >
          {item.title}
        </button>
        <span aria-hidden className="px-3 text-neutral-600">
          ·
        </span>
      </span>
    ));

  return (
    <section className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Izquierda: título arriba + cinta de canciones girando debajo */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="text-xl font-semibold">La música oficial de la polla by Tokio Blues 🥤</h2>

          <div
            className="relative overflow-hidden"
            onMouseEnter={() => {
              targetRef.current = SLOW_SPEED;
            }}
            onMouseLeave={() => {
              targetRef.current = NORMAL_SPEED;
            }}
            style={{
              maskImage:
                "linear-gradient(to right, transparent, #000 4%, #000 96%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, #000 4%, #000 96%, transparent)",
            }}
          >
            <div ref={trackRef} className="flex w-max will-change-transform">
              {row("a")}
              {row("b")}
            </div>
          </div>
        </div>

        {/* Derecha: mini-reproductor compacto */}
        <div className="sm:w-[300px] sm:shrink-0">
          {embed ? (
            <iframe
              src={embed}
              title="Reproductor de Spotify"
              className="w-full rounded-xl"
              height={80}
              style={{ border: 0 }}
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="flex h-[80px] items-center justify-center rounded-xl border border-neutral-800 text-sm text-neutral-500">
              Elige una canción
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
