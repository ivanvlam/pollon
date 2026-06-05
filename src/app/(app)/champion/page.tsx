import Link from "next/link";

import { ChampionCountdown } from "@/components/ChampionCountdown";
import { ChampionForm } from "@/components/ChampionForm";
import { TopScorerForm } from "@/components/TopScorerForm";
import { createClient } from "@/lib/supabase/server";
import { toSpanish } from "@/lib/teamNames";
import { isChampionLocked } from "@/lib/timing";

export const metadata = { title: "Mi campeón y goleador" };

export default async function ChampionPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [
    { data: championPick },
    { data: topScorerPick },
    { data: matches },
    { data: players },
  ] = await Promise.all([
    supabase.from("champion_predictions").select("team, is_locked").eq("user_id", user!.id).maybeSingle(),
    supabase.from("top_scorer_predictions").select("player_name, is_locked").eq("user_id", user!.id).maybeSingle(),
    supabase.from("matches").select("home_team, away_team, kickoff_at"),
    supabase.from("players").select("name, team").order("name"),
  ]);

  const teams = [
    ...new Set((matches ?? []).flatMap((m) => [m.home_team, m.away_team])),
  ].sort().map(toSpanish);

  const firstKickoff =
    (matches ?? []).map((m) => m.kickoff_at).sort((a, b) => a.localeCompare(b))[0] ?? null;

  const closed = isChampionLocked(firstKickoff);
  const championClosed = Boolean(championPick?.is_locked) || closed;
  const topScorerClosed = Boolean(topScorerPick?.is_locked) || closed;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🏆 Campeón y Goleador</h1>
        <Link href="/dashboard" className="text-sm text-neutral-400 hover:text-white">
          ← Volver
        </Link>
      </header>

      <div className="flex items-center gap-3">
        <ChampionCountdown firstKickoffAt={firstKickoff} />
        <p className="text-sm text-neutral-500">
          Ambas predicciones cierran 1 hora antes del primer partido
        </p>
      </div>

      {/* Campeón */}
      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Campeón del Mundial <span className="text-emerald-400">+15 pts</span></h2>
        </div>
        <p className="text-sm text-neutral-400">
          Elige quién crees que ganará el Mundial 2026. Independiente de la predicción de la final.
        </p>

        {championClosed ? (
          <p className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm">
            {championPick?.team
              ? `Tu campeón: ${toSpanish(championPick.team)}`
              : "No registraste ningún campeón antes del cierre."}
          </p>
        ) : teams.length === 0 ? (
          <p className="text-sm text-neutral-400">No hay equipos cargados aún.</p>
        ) : (
          <ChampionForm teams={teams} initialTeam={championPick?.team ? toSpanish(championPick.team) : null} />
        )}
      </section>

      {/* Goleador */}
      <section className="flex flex-col gap-3 rounded-xl border border-neutral-800 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Goleador del Mundial <span className="text-emerald-400">+10 pts</span></h2>
        </div>
        <p className="text-sm text-neutral-400">
          Elige quién crees que será el máximo goleador del torneo.
        </p>

        {topScorerClosed ? (
          <p className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm">
            {topScorerPick?.player_name
              ? `Tu goleador: ${topScorerPick.player_name}`
              : "No registraste ningún goleador antes del cierre."}
          </p>
        ) : (players ?? []).length === 0 ? (
          <p className="text-sm text-neutral-400">
            Los jugadores aún no están cargados. El administrador debe sincronizarlos desde el panel admin.
          </p>
        ) : (
          <TopScorerForm
            players={players ?? []}
            initialPlayer={topScorerPick?.player_name ?? null}
          />
        )}
      </section>
    </div>
  );
}
