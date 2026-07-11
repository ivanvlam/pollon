"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toaster de la app, temático con los tokens de diseño (solo dark).
 * Se monta una vez en el root layout; los toasts se disparan con
 * `toast.success/error(...)` desde cualquier componente cliente.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      className="toaster group"
      style={
        {
          "--normal-bg": "hsl(var(--card))",
          "--normal-text": "hsl(var(--card-foreground))",
          "--normal-border": "hsl(var(--border))",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
