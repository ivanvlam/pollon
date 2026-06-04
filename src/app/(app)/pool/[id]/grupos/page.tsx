import Link from "next/link";

import { Flag } from "@/components/Flag";
import { PredictionForm } from "@/components/PredictionForm";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { computeGroupStandings, type GroupMatch } from "@/lib/standings";
import { isPredictionLocked } from "@/lib/timing";

export const metadata = { title: "Grupos" };

export default async function GroupsPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  const { data: matches } = await supabase
    .from("matches")
    .select(
      "id, group_name, home_team, away_team, kickoff_at, status, home_score, away_score, is_active",
    )
    .eq("round", "group_stage")
    .order("kickoff_at", { ascending: true });

  const all = matches ?? [];
  const ids = all.map((m) => m.id);

  const { data: myPreds } = await supabase
    .from("predictions")
    .select("match_id, predicted_home, predicted_away")
    .eq("user_id", uid)
    .in("match_id", ids.length > 0 ? ids : ["x"]);
  const predByMatch = new Map((myPreds ?? []).map((p) => [p.match_id, p]));

  const { data: myScores } = await supabase
    .from("scores")
    .select("match_id, points")
    .eq("pool_id", params.id)
    .eq("user_id", uid);
  const pointsByMatch = new Map(
    (myScores ?? [])
      .filter((s) => s.match_id !== null)
      .map((s) => [s.match_id as string, s.points]),
  );

  // Agrupar por group_name.
  const groups = new Map<string, typeof all>();
  for (const m of all) {
    const key = m.group_name ?? "Sin grupo";
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  const groupNames = [...groups.keys()].sort();

  const fmtScore = (h: number | null, a: number | null) =>
    h === null || a === null ? "-" : `${h}-${a}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Grupos</h1>
        <Link
          href={`/pool/${params.id}`}
          className="text-sm text-emerald-400 hover:underline"
        >
          Volver al ranking
        </Link>
      </header>

      {groupNames.length === 0 && (
        <p className="text-neutral-400">Aún no hay partidos de fase de grupos.</p>
      )}

      {groupNames.map((name) => {
        const groupMatches = groups.get(name)!;
        const standings = computeGroupStandings(groupMatches as GroupMatch[]);
        const yourPoints = groupMatches.reduce(
          (sum, m) => sum + (pointsByMatch.get(m.id) ?? 0),
          0,
        );

        return (
          <Card key={name} className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{name}</h2>
              <span className="text-sm text-emerald-400">
                Tus puntos aquí: {yourPoints}
              </span>
            </div>

            {/* Tabla de posiciones FIFA */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[20rem] text-left text-sm">
                <thead className="border-b border-neutral-800 text-neutral-500">
                  <tr>
                    <th className="py-1 pr-2">#</th>
                    <th className="py-1">Equipo</th>
                    <th className="py-1 pr-2 text-center">PJ</th>
                    <th className="py-1 pr-2 text-center">DG</th>
                    <th className="py-1 text-center">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((row, i) => (
                    <tr key={row.team} className="border-b border-neutral-900">
                      <td className="py-1.5 pr-2 text-neutral-500">{i + 1}</td>
                      <td className="py-1.5">
                        <span className="flex items-center gap-2">
                          <Flag team={row.team} />
                          {row.team}
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-center text-neutral-400">
                        {row.played}
                      </td>
                      <td className="py-1.5 pr-2 text-center text-neutral-400">
                        {row.gd > 0 ? `+${row.gd}` : row.gd}
                      </td>
                      <td className="py-1.5 text-center font-semibold">
                        {row.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Partidos del grupo */}
            <div className="flex flex-col gap-3">
              {groupMatches.map((match) => {
                const pred = predByMatch.get(match.id);
                const locked = isPredictionLocked(match.kickoff_at);
                const finished = match.status === "finished";
                const openToPredict = match.is_active && !locked;

                return (
                  <div
                    key={match.id}
                    className="rounded-lg border border-neutral-800 p-3"
                  >
                    <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
                      <span>{new Date(match.kickoff_at).toLocaleString()}</span>
                      {finished ? (
                        <span className="font-medium text-neutral-300">
                          Final {fmtScore(match.home_score, match.away_score)}
                        </span>
                      ) : locked ? (
                        <span>cerrado</span>
                      ) : (
                        <span className="text-emerald-400">abierto</span>
                      )}
                    </div>

                    {openToPredict ? (
                      <PredictionForm
                        matchId={match.id}
                        homeTeam={match.home_team}
                        awayTeam={match.away_team}
                        isKnockout={false}
                        initialHome={pred?.predicted_home ?? null}
                        initialAway={pred?.predicted_away ?? null}
                        initialWinner={null}
                      />
                    ) : (
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Flag team={match.home_team} />
                          {match.home_team}
                          <span className="text-neutral-500">vs</span>
                          {match.away_team}
                          <Flag team={match.away_team} />
                        </span>
                        <span className="text-neutral-400">
                          {pred
                            ? `Tu pronóstico: ${fmtScore(pred.predicted_home, pred.predicted_away)}`
                            : "sin pronóstico"}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
