import { Flag } from "@/components/Flag";
import { MatchLiveRefresh } from "@/components/MatchLiveRefresh";
import { formatLiveMinute } from "@/lib/liveMinute";
import { toSpanish } from "@/lib/teamNames";

export interface LiveMatchRow {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  live_minute: string | null;
  pred: { predicted_home: number | null; predicted_away: number | null } | null;
}

/**
 * Sección "En vivo" del inicio. Muestra los partidos en curso con marcador y
 * minuto. El encabezado lleva la nota de frescura ("datos cada ~10 min") y la
 * latencia ("act. hace Xm"). No renderiza nada si no hay partidos live.
 * Incluye el auto-refresco (lee nuestra base, no gasta cuota de la API).
 */
export function LiveMatches({
  matches,
  updatedAgoLabel,
}: {
  matches: LiveMatchRow[];
  updatedAgoLabel: string | null;
}) {
  if (matches.length === 0) return null;

  return (
    <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
      {/* Todos los de esta lista están live, así que el refresco se activa. */}
      <MatchLiveRefresh matches={[{ status: "live" }]} />
      <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-400">
            En vivo
          </h2>
        </span>
        <span className="text-xs text-neutral-500">
          · datos cada ~10 min{updatedAgoLabel ? ` · ${updatedAgoLabel}` : ""}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {matches.map((m) => {
          const minute = formatLiveMinute(m.live_minute);
          const hasPred =
            m.pred &&
            (m.pred.predicted_home !== null || m.pred.predicted_away !== null);
          return (
            <li
              key={m.id}
              className="rounded-lg bg-neutral-900/50 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-medium">
                  <Flag team={m.home_team} />
                  {toSpanish(m.home_team)}
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-semibold text-neutral-100">
                    {m.home_score ?? 0} - {m.away_score ?? 0}
                  </span>
                  {minute && <span className="text-xs text-red-400">{minute}</span>}
                </span>
                <span className="flex items-center justify-end gap-2 text-right font-medium">
                  {toSpanish(m.away_team)}
                  <Flag team={m.away_team} />
                </span>
              </div>
              <p className="mt-1.5 text-center text-xs text-neutral-500">
                {hasPred ? (
                  <>
                    Tu predicción:{" "}
                    <span className="text-neutral-300">
                      {m.pred!.predicted_home ?? "-"}-{m.pred!.predicted_away ?? "-"}
                    </span>
                  </>
                ) : (
                  "No predijiste este partido"
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
