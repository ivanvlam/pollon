import { cn } from "@/lib/cn";

/** Bloque de carga con forma. Usar para siluetas de tablas/cards. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
