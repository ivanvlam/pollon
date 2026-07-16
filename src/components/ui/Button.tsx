import { cva } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

/**
 * Variantes del sistema de botones (cva). Mantiene los nombres y el look
 * previos, añadiendo el micro-feedback de "press" (active:scale) que respeta
 * prefers-reduced-motion.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition " +
    "active:scale-[0.97] motion-reduce:active:scale-100 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 " +
    "disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-emerald-500 text-neutral-950 hover:bg-emerald-400",
        secondary: "border border-neutral-700 text-neutral-100 hover:bg-neutral-800",
        ghost: "text-neutral-300 hover:bg-neutral-800 hover:text-white",
        danger: "text-red-400 hover:bg-red-500/10",
      },
      size: {
        sm: "px-3 py-1.5 text-sm",
        md: "px-4 py-2 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

/**
 * Clases del sistema de botones, reutilizables en elementos que no son
 * <button> (ej. <Link> que debe verse como botón). Misma fuente de verdad
 * que el componente Button, para mantener el estilo uniforme.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(buttonVariants({ variant, size }), className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={buttonClasses(variant, size, className)}
      {...props}
    />
  ),
);

Button.displayName = "Button";
