export default function PoolLoading() {
  return (
    <div className="flex flex-col gap-8 animate-pulse">
      {/* Back link */}
      <div className="h-4 w-32 rounded bg-neutral-800" />

      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="h-7 w-48 rounded bg-neutral-800" />
        <div className="h-4 w-36 rounded bg-neutral-800" />
      </div>

      {/* Nav tabs */}
      <div className="flex gap-2">
        {[80, 96, 72, 88].map((w, i) => (
          <div key={i} className="h-8 rounded-lg bg-neutral-800" style={{ width: w }} />
        ))}
      </div>

      {/* Content rows */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-neutral-800/60" />
        ))}
      </div>
    </div>
  );
}
