import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton mostrado mientras cargan las páginas del área privada. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando">
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4"
          >
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
