/** Skeleton mostrado mientras cargan las páginas del área privada. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-xl border border-neutral-800 bg-neutral-900/40"
          />
        ))}
      </div>
    </div>
  );
}
