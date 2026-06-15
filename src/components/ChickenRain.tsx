"use client";

import { useEffect, useState } from "react";

// Easter egg: lluvia de gallinas 🐔 que llena la pantalla. Se monta solo en el
// perfil de cierto jugador. Es puramente decorativo: pointer-events-none para no
// interferir con la página, y por debajo de los modales (z-40 < z-50/60).

interface Chicken {
  left: number; // %
  size: number; // rem
  duration: number; // s
  delay: number; // s (negativo → arranca a mitad de caída)
  drift: number; // px de desplazamiento horizontal
  rotate: number; // deg de giro
}

const COUNT = 60;

export function ChickenRain() {
  // Generar las posiciones en el cliente (tras montar) para evitar mismatch de
  // hidratación por usar Math.random en el render del servidor.
  const [chickens, setChickens] = useState<Chicken[]>([]);

  useEffect(() => {
    setChickens(
      Array.from({ length: COUNT }, () => ({
        left: Math.random() * 100,
        size: 1.4 + Math.random() * 1.9,
        duration: 4 + Math.random() * 5,
        delay: -Math.random() * 9,
        drift: (Math.random() - 0.5) * 90,
        rotate: (Math.random() - 0.5) * 90,
      })),
    );
  }, []);

  if (chickens.length === 0) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      <style>{`
        @keyframes chicken-fall {
          0%   { transform: translate3d(0, -12vh, 0) rotate(0deg); }
          100% { transform: translate3d(var(--drift), 112vh, 0) rotate(var(--rot)); }
        }
      `}</style>
      {chickens.map((c, i) => {
        const style: React.CSSProperties = {
          left: `${c.left}%`,
          fontSize: `${c.size}rem`,
          animation: `chicken-fall ${c.duration}s linear ${c.delay}s infinite`,
          willChange: "transform",
        };
        const vars = style as Record<string, string>;
        vars["--drift"] = `${c.drift}px`;
        vars["--rot"] = `${c.rotate}deg`;
        return (
          <span key={i} className="absolute top-0 select-none" style={style}>
            🐔
          </span>
        );
      })}
    </div>
  );
}
