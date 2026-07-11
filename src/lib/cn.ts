import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Une clases condicionales y deduplica utilidades de Tailwind en conflicto
 * (ej. `px-2 px-4` → `px-4`). Base de estilo compartida por los primitivos
 * de UI y el resto de la app.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
