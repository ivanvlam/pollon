import Link from "next/link";

import { ChampionForm } from "@/components/ChampionForm";
import { createClient } from "@/lib/supabase/server";
import { isChampionLocked } from "@/lib/timing";

export const metadata = { title: "Mi campeón" };

export default async function ChampionPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Predicción de campeón del usuario (RLS permite ver la propia).
  const { data: pick } = await supabase
    .from("champion_predictions")
    .select("team, is_locked")
    .eq("user_id", user!.id)
    .maybeSingle();

  // Lista de equipos a partir de los partidos cargados.
  const { data: matches } = await supabase
    .from("matches")
    .select("home_team, away_team, kickoff_at");

  const teams = [
    ...new Set(
      (matches ?? []).flatMap((m) => [m.home_team, m.away_team]),
    ),
  ].sort();

  // Cierre: 24h antes del primer partido, o si ya está bloqueada.
  const firstKickoff =
    (matches ?? [])
      .map((m) => m.kickoff_at)
      .sort((a, b) => a.localeCompare(b))[0] ?? null;
  const closed = Boolean(pick?.is_locked) || isChampionLocked(firstKickoff);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🏆 Tu campeón del Mundial</h1>
        <Link href="/dashboard" className="text-sm underline">
          Volver
        </Link>
      </header>

      <p className="text-sm text-neutral-400">
        Elige quién crees que ganará el Mundial 2026. Se cierra 24 horas antes
        del primer partido y es independiente de tu predicción de la final.
      </p>

      {closed ? (
        <p className="rounded-lg border border-neutral-800 p-4">
          {pick?.team
            ? `Tu campeón: ${pick.team} (predicción cerrada)`
            : "La predicción de campeón ya cerró y no registraste ninguna."}
        </p>
      ) : teams.length === 0 ? (
        <p className="text-neutral-400">
          Aún no hay equipos cargados. Vuelve cuando se publique el fixture.
        </p>
      ) : (
        <ChampionForm teams={teams} initialTeam={pick?.team ?? null} />
      )}
    </div>
  );
}
