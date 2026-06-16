// SVG de un auto de carrera visto de lado. La carrocería se pinta con el color
// del jugador (mismo color que su línea en el gráfico del historial); ventana y
// ruedas en tonos oscuros fijos para que el color se lea bien sobre el fondo.

export function CarIcon({ color, className }: { color: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 30"
      className={className}
      role="img"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {/* Carrocería */}
      <path
        d="M2 22 L2 19 Q2 17 4 17 L13 17 L20 10 Q21.5 8.5 24 8.5 L35 8.5 Q38 8.5 40 10.5 L46 17 L59 17 Q61.5 17 61.5 19.5 L61.5 22 Q61.5 23.5 60 23.5 L3.5 23.5 Q2 23.5 2 22 Z"
        fill={color}
      />
      {/* Cabina / parabrisas */}
      <path
        d="M22 12 L34 12 Q36 12 37.3 13.5 L41 17 L19.5 17 Z"
        fill="rgba(10,10,11,0.40)"
      />
      {/* Ruedas */}
      <circle cx="17" cy="23.5" r="5.5" fill="#0a0a0b" />
      <circle cx="17" cy="23.5" r="2.2" fill="#52525b" />
      <circle cx="47" cy="23.5" r="5.5" fill="#0a0a0b" />
      <circle cx="47" cy="23.5" r="2.2" fill="#52525b" />
    </svg>
  );
}
