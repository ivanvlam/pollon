import Link from "next/link";
import { notFound } from "next/navigation";

import { Flag } from "@/components/Flag";
import { isKnockoutRound, ROUNDS, type Round } from "@/lib/constants";
import { REASON_LABELS, ROUND_LABELS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import { toSpanish } from "@/lib/teamNames";
import { isChampionLocked, isPredictionLocked } from "@/lib/timing";
import type { ScoreReason } from "@/types";

const fmt = (h: number | null, a: number | null) =>
  h === null || a === null ? "—" : `${h}-${a}`;

const DATE_FMT = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const displayGroup = (name: string) => name.replace(/^Group\s+/i, "Grupo ");

/** Nombre del equipo clasificado a partir de winner. */
function qualifierName(
  winner: string | null,
  home: string,
  away: string,
): string | null {
  if (winner === "home") return toSpanish(home);
  if (winner === "away") return toSpanish(away);
  return null;
}

export default async function PlayerProfilePage({
  params,
}: {
  params: { id: string; userId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: pool } = await supabase
    .from("pools")
    .select("id, name")
    .eq("id", params.id)
    .maybeSingle();
  if (!pool) notFound();

  // El target debe ser miembro de esta polla (la RLS ya exige que el viewer
  // también lo sea para llegar hasta acá).
  const { data: membership } = await supabase
    .from("pool_members")
    .select("user_id")
    .eq("pool_id", pool.id)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (!membership) notFound();

  const isSelf = user!.id === params.userId;

  const [
    { data: profile },
    { data: ranking },
    { data: matches },
    { data: preds },
    { data: scores },
    { data: championPick },
    { data: topScorerPick },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", params.userId).maybeSingle(),
    supabase.rpc("get_pool_ranking", { p_pool_id: pool.id }),
    supabase
      .from("matches")
      .select(
        "id, round, group_name, home_team, away_team, kickoff_at, status, home_score, away_score, winner",
      )
      .eq("is_active", true)
      .order("kickoff_at", { ascending: true }),
    // RLS: predicciones ajenas solo se devuelven cuando el partido ya cerró.
    supabase
      .from("predictions")
      .select("match_id, predicted_home, predicted_away, predicted_winner")
      .eq("user_id", params.userId),
    supabase
      .from("scores")
      .select("match_id, points, reason")
      .eq("pool_id", pool.id)
      .eq("user_id", params.userId),
    // RLS: campeón/goleador ajenos solo se devuelven con is_locked = true.
    supabase.from("champion_predictions").select("team").eq("user_id", params.userId).maybeSingle(),
    supabase
      .from("top_scorer_predictions")
      .select("player_name")
      .eq("user_id", params.userId)
      .maybeSingle(),
  ]);

  const name = profile?.display_name ?? "Jugador";

  const rankingRows = ranking ?? [];
  const idx = rankingRows.findIndex((r) => r.user_id === params.userId);
  const row = idx >= 0 ? rankingRows[idx] : null;
  const rank = idx >= 0 ? idx + 1 : null;

  const predByMatch = new Map((preds ?? []).map((p) => [p.match_id, p]));
  const scoreByMatch = new Map(
    (scores ?? [])
      .filter((s) => s.match_id !== null)
      .map((s) => [s.match_id as string, s]),
  );
  const championScore = (scores ?? []).find((s) => s.reason === "champion");
  const topScorerScore = (scores ?? []).find((s) => s.reason === "top_scorer");

  const activeMatches = matches ?? [];
  const firstKickoff =
    activeMatches.map((m) => m.kickoff_at).sort((a, b) => a.localeCompare(b))[0] ?? null;
  const specialsClosed = isChampionLocked(firstKickoff);

  // Texto del pick especial (campeón/goleador) respetando visibilidad.
  function specialPick(value: string | null | undefined): {
    text: string;
    hidden: boolean;
  } {
    if (value) return { text: value, hidden: false };
    if (isSelf) return { text: "No elegiste", hidden: false };
    if (!specialsClosed) return { text: "🔒 Se revela al cierre", hidden: true };
    return { text: "No eligió", hidden: false };
  }

  const champion = specialPick(championPick?.team ? toSpanish(championPick.team) : null);
  const topScorer = specialPick(topScorerPick?.player_name ?? null);

  const sections = ROUNDS.map((round) => ({
    label: ROUND_LABELS[round],
    matches: activeMatches.filter((m) => m.round === round),
  })).filter((s) => s.matches.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <Link
        href={`/pool/${pool.id}`}
        className="text-sm text-neutral-400 hover:text-white"
      >
        ← Volver al ranking
      </Link>

      {/* Cabecera */}
      <header className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{name}</h1>
          {isSelf && <span className="text-xs text-emerald-400">(tú)</span>}
          {row?.champion_correct && <span title="Campeón acertado">🏆</span>}
        </div>
        <p className="text-sm text-neutral-400">
          {rank ? `Puesto #${rank}` : "Sin posición"} en {pool.name}
        </p>
        <div className="mt-2 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-2xl font-bold text-emerald-400">{row?.total ?? 0}</span>{" "}
            <span className="text-neutral-500">pts</span>
          </div>
          <div className="flex gap-4 text-neutral-400">
            <span title="Marcador exacto · 5 pts">Exactos: {row?.exact_count ?? 0}</span>
            <span title="Misma diferencia · 3 pts">Dif: {row?.diff_count ?? 0}</span>
            <span title="Solo ganador/clasificado · 2 pts">
              Aciertos: {row?.winner_count ?? 0}
            </span>
          </div>
        </div>
      </header>

      {/* Apuestas especiales */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 rounded-xl border border-neutral-800 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-300">Campeón</h2>
            {championScore && (
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                +{championScore.points} pts
              </span>
            )}
          </div>
          <p className={champion.hidden ? "text-sm text-neutral-500" : "text-base"}>
            {champion.text}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-neutral-800 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-300">Goleador</h2>
            {topScorerScore && (
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                +{topScorerScore.points} pts
              </span>
            )}
          </div>
          <p className={topScorer.hidden ? "text-sm text-neutral-500" : "text-base"}>
            {topScorer.text}
          </p>
        </div>
      </section>

      {/* Predicciones */}
      <section className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold">Predicciones</h2>
        {sections.length === 0 ? (
          <p className="text-neutral-400">Aún no hay partidos habilitados.</p>
        ) : (
          sections.map((section) => (
            <div key={section.label} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {section.label}
              </h3>
              <div className="flex flex-col gap-2">
                {section.matches.map((m) => {
                  const pred = predByMatch.get(m.id);
                  const score = scoreByMatch.get(m.id);
                  const locked = isPredictionLocked(m.kickoff_at);
                  const knockout = isKnockoutRound(m.round as Round);
                  const finished = m.status === "finished";
                  // Solo otros usuarios antes del cierre quedan ocultos: para
                  // ellos la RLS no devuelve la predicción todavía.
                  const hidden = !isSelf && !locked && !pred;

                  return (
                    <div
                      key={m.id}
                      className="flex flex-col gap-1 rounded-lg border border-neutral-800 p-3 text-sm"
                    >
                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>
                          {m.group_name ? displayGroup(m.group_name) : ROUND_LABELS[m.round as Round]}
                        </span>
                        <span>
                          {DATE_FMT.format(new Date(m.kickoff_at))}
                          {finished && (
                            <>
                              {" · "}
                              <span className="font-medium text-neutral-300">
                                Final {fmt(m.home_score, m.away_score)}
                                {knockout && m.winner
                                  ? ` (${qualifierName(m.winner, m.home_team, m.away_team)})`
                                  : ""}
                              </span>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-medium">
                          <Flag team={m.home_team} />
                          {toSpanish(m.home_team)}
                          <span className="text-neutral-500">vs</span>
                          {toSpanish(m.away_team)}
                          <Flag team={m.away_team} />
                        </span>
                        {score && (
                          <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                            {REASON_LABELS[score.reason as ScoreReason]} · +{score.points} pts
                          </span>
                        )}
                      </div>

                      <p className="text-neutral-300">
                        {hidden ? (
                          <span className="text-neutral-500">
                            🔒 Se revela 1h antes del partido
                          </span>
                        ) : pred ? (
                          <>
                            Pronóstico: {fmt(pred.predicted_home, pred.predicted_away)}
                            {pred.predicted_winner
                              ? ` · ${qualifierName(pred.predicted_winner, m.home_team, m.away_team)}`
                              : ""}
                          </>
                        ) : (
                          <span className="text-neutral-500">Sin predicción</span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
