import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminChampion } from "@/components/AdminChampion";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { AdminMatchRow } from "@/components/AdminMatchRow";
import { AdminRoundActivator } from "@/components/AdminRoundActivator";
import { AdminTopScorer } from "@/components/AdminTopScorer";
import { adminDeletePool, adminDeleteUser } from "@/lib/admin/actions";
import { isKnockoutRound, ROUNDS } from "@/lib/constants";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { toSpanish } from "@/lib/teamNames";
import type { MatchStatus, MatchWinner, Round } from "@/types";

export const metadata = { title: "Admin" };

const ROUND_LABELS: Record<string, string> = {
  round_of_32: "Ronda de 32",
  round_of_16: "Octavos de final",
  quarterfinal: "Cuartos de final",
  semifinal: "Semifinales",
  final: "Final",
};

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }) : "s/d";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <p className="text-2xl font-bold text-neutral-100">{value}</p>
      <p className="mt-1 text-xs text-neutral-400">{label}</p>
    </div>
  );
}

function Highlight({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 truncate font-semibold text-neutral-100">{value}</p>
      {sub && <p className="text-xs text-neutral-500">{sub}</p>}
    </div>
  );
}

/** Devuelve la clave con mayor valor de un mapa de conteos. */
function topKey(map: Map<string, number>): { key: string; n: number } | null {
  let best: { key: string; n: number } | null = null;
  for (const [key, n] of map) if (!best || n > best.n) best = { key, n };
  return best;
}

export default async function GlobalAdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) notFound();

  const svc = createServiceRoleClient();

  const [
    { data: profiles },
    { data: pools },
    { data: members },
    { data: scoreRows },
    { data: predRows },
    { data: matches },
    { data: players },
    { data: champPicks },
    { data: scorerPicks },
  ] = await Promise.all([
    svc.from("profiles").select("id, display_name, created_at"),
    svc.from("pools").select("id, name, created_at, created_by"),
    svc.from("pool_members").select("pool_id, user_id"),
    svc.from("scores").select("pool_id, user_id, points"),
    svc.from("predictions").select("user_id"),
    svc
      .from("matches")
      .select("id, round, home_team, away_team, kickoff_at, is_active, home_score, away_score, winner, status")
      .order("kickoff_at", { ascending: true }),
    svc.from("players").select("name, team").order("name"),
    svc.from("champion_predictions").select("team"),
    svc.from("top_scorer_predictions").select("player_name"),
  ]);

  // Emails desde Auth admin (paginado).
  const emailById = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    const us = data?.users ?? [];
    for (const u of us) if (u.email) emailById.set(u.id, u.email);
    if (us.length < 1000) break;
  }

  const allProfiles = profiles ?? [];
  const allPools = pools ?? [];
  const allMembers = members ?? [];
  const allMatches = matches ?? [];

  const userCount = allProfiles.length;
  const poolCount = allPools.length;
  const membershipCount = allMembers.length;

  const membersByPool = new Map<string, number>();
  const poolsByUser = new Map<string, number>();
  for (const m of allMembers) {
    membersByPool.set(m.pool_id, (membersByPool.get(m.pool_id) ?? 0) + 1);
    poolsByUser.set(m.user_id, (poolsByUser.get(m.user_id) ?? 0) + 1);
  }
  const poolsWithScores = new Set((scoreRows ?? []).map((s) => s.pool_id));
  const nameById = new Map(allProfiles.map((p) => [p.id, p.display_name]));

  // Predicciones por usuario.
  const predCount = (predRows ?? []).length;
  const predsByUser = new Map<string, number>();
  for (const p of predRows ?? []) {
    predsByUser.set(p.user_id, (predsByUser.get(p.user_id) ?? 0) + 1);
  }
  const activeUsers = predsByUser.size;

  // Puntos por usuario: el puntaje es el mismo en todas sus pollas, así que
  // tomamos el total de una polla (el máximo, por robustez ante backfills).
  const totalByUserPool = new Map<string, number>();
  for (const s of scoreRows ?? []) {
    const k = `${s.user_id}|${s.pool_id}`;
    totalByUserPool.set(k, (totalByUserPool.get(k) ?? 0) + (s.points ?? 0));
  }
  const pointsByUser = new Map<string, number>();
  for (const [k, v] of totalByUserPool) {
    const uid = k.slice(0, k.indexOf("|"));
    pointsByUser.set(uid, Math.max(pointsByUser.get(uid) ?? 0, v));
  }

  // Promedios y agregados.
  const participants = allProfiles.filter((p) => poolsByUser.has(p.id)).length;
  const totalPoints = [...pointsByUser.values()].reduce((a, b) => a + b, 0);
  const avgPoints = participants ? (totalPoints / participants).toFixed(1) : "0";
  const avgPredsPerUser = userCount ? (predCount / userCount).toFixed(1) : "0";
  const usersWithoutPool = userCount - participants;
  const activePoolsCount = allPools.filter((p) => poolsWithScores.has(p.id)).length;
  const participationPct = userCount ? Math.round((activeUsers / userCount) * 100) : 0;

  const totalMatches = allMatches.length;
  const finishedMatches = allMatches.filter((m) => m.status === "finished").length;
  const activeMatches = allMatches.filter((m) => m.is_active).length;
  const avgPredsPerActiveMatch = activeMatches ? (predCount / activeMatches).toFixed(1) : "0";

  // Campeón / goleador: conteos y favoritos.
  const champByTeam = new Map<string, number>();
  for (const c of champPicks ?? []) champByTeam.set(c.team, (champByTeam.get(c.team) ?? 0) + 1);
  const scorerByPlayer = new Map<string, number>();
  for (const s of scorerPicks ?? []) scorerByPlayer.set(s.player_name, (scorerByPlayer.get(s.player_name) ?? 0) + 1);
  const champCount = (champPicks ?? []).length;
  const scorerCount = (scorerPicks ?? []).length;
  const topChampion = topKey(champByTeam);
  const topScorerPick = topKey(scorerByPlayer);

  // Destacados.
  const leader = topKey(pointsByUser);
  const mostPredictions = topKey(predsByUser);
  const biggestPool = topKey(membersByPool);

  const poolsSorted = [...allPools].sort((a, b) => a.name.localeCompare(b.name));
  const usersSorted = [...allProfiles].sort((a, b) =>
    (a.display_name ?? "").localeCompare(b.display_name ?? ""),
  );

  const teams = [
    ...new Set(allMatches.flatMap((m) => [m.home_team, m.away_team])),
  ]
    .sort()
    .map(toSpanish);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panel de administración</h1>
        <Link href="/dashboard" className="text-sm text-neutral-400 hover:text-white">
          ← Volver
        </Link>
      </header>

      {/* Estadísticas */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Estadísticas</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Participantes" value={userCount} />
          <Stat label="Pollas" value={poolCount} />
          <Stat label="Predicciones" value={predCount} />
          <Stat label="Predicciones por usuario (prom.)" value={avgPredsPerUser} />
          <Stat label="Puntos promedio por participante" value={avgPoints} />
          <Stat label="Usuarios activos" value={`${activeUsers} (${participationPct}%)`} />
          <Stat label="Membresías totales" value={membershipCount} />
          <Stat label="Pollas por usuario (prom.)" value={userCount ? (membershipCount / userCount).toFixed(1) : "0"} />
          <Stat label="Participantes por polla (prom.)" value={poolCount ? (membershipCount / poolCount).toFixed(1) : "0"} />
          <Stat label="Partidos (finalizados / total)" value={`${finishedMatches} / ${totalMatches}`} />
          <Stat label="Predicciones por partido activo (prom.)" value={avgPredsPerActiveMatch} />
          <Stat label="Pollas con puntos" value={activePoolsCount} />
          <Stat label="Usuarios sin polla" value={usersWithoutPool} />
          <Stat label="Eligieron campeón" value={champCount} />
          <Stat label="Eligieron goleador" value={scorerCount} />
        </div>
      </section>

      {/* Destacados */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Destacados</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Highlight
            label="Líder global (más puntos)"
            value={leader ? (nameById.get(leader.key) ?? "?") : "s/d"}
            sub={leader ? `${leader.n} pts` : undefined}
          />
          <Highlight
            label="Más predicciones"
            value={mostPredictions ? (nameById.get(mostPredictions.key) ?? "?") : "s/d"}
            sub={mostPredictions ? `${mostPredictions.n} predicciones` : undefined}
          />
          <Highlight
            label="Polla más grande"
            value={biggestPool ? (allPools.find((p) => p.id === biggestPool.key)?.name ?? "?") : "s/d"}
            sub={biggestPool ? `${biggestPool.n} participantes` : undefined}
          />
          <Highlight
            label="Campeón más elegido"
            value={topChampion ? toSpanish(topChampion.key) : "s/d"}
            sub={topChampion ? `${topChampion.n} votos` : undefined}
          />
          <Highlight
            label="Goleador más elegido"
            value={topScorerPick ? topScorerPick.key : "s/d"}
            sub={topScorerPick ? `${topScorerPick.n} votos` : undefined}
          />
        </div>
      </section>

      {/* Gestión de pollas */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Pollas ({poolCount})</h2>
        {poolsSorted.length === 0 ? (
          <p className="text-sm text-neutral-400">No hay pollas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-neutral-800 text-neutral-400">
                <tr>
                  <th scope="col" className="py-2">Nombre</th>
                  <th scope="col" className="py-2">Creador</th>
                  <th scope="col" className="py-2 text-center">Particip.</th>
                  <th scope="col" className="py-2 text-center">Puntos</th>
                  <th scope="col" className="py-2">Creada</th>
                  <th scope="col" className="py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody>
                {poolsSorted.map((p) => (
                  <tr key={p.id} className="border-b border-neutral-900">
                    <td className="py-2 font-medium text-neutral-100">{p.name}</td>
                    <td className="py-2 text-neutral-400">{nameById.get(p.created_by) ?? "?"}</td>
                    <td className="py-2 text-center text-neutral-400">{membersByPool.get(p.id) ?? 0}</td>
                    <td className="py-2 text-center text-neutral-400">
                      {poolsWithScores.has(p.id) ? "sí" : "no"}
                    </td>
                    <td className="py-2 text-neutral-400">{fmtDate(p.created_at)}</td>
                    <td className="py-2 text-right">
                      <AdminDeleteButton action={adminDeletePool.bind(null, p.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Gestión de usuarios */}
      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Usuarios ({userCount})</h2>
        <p className="text-xs text-neutral-500">
          El puntaje de un usuario es el mismo en todas sus pollas.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-left text-sm">
            <thead className="border-b border-neutral-800 text-neutral-400">
              <tr>
                <th scope="col" className="py-2">Nombre</th>
                <th scope="col" className="py-2">Email</th>
                <th scope="col" className="py-2 text-center">Pollas</th>
                <th scope="col" className="py-2 text-center">Predic.</th>
                <th scope="col" className="py-2 text-center">Puntos</th>
                <th scope="col" className="py-2">Registrado</th>
                <th scope="col" className="py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {usersSorted.map((u) => {
                const isMe = u.id === user.id;
                return (
                  <tr key={u.id} className="border-b border-neutral-900">
                    <td className="py-2 font-medium text-neutral-100">
                      {u.display_name}
                      {isMe && <span className="ml-2 text-xs text-emerald-400">(tú)</span>}
                    </td>
                    <td className="py-2 text-neutral-400">{emailById.get(u.id) ?? "s/d"}</td>
                    <td className="py-2 text-center text-neutral-400">{poolsByUser.get(u.id) ?? 0}</td>
                    <td className="py-2 text-center text-neutral-400">{predsByUser.get(u.id) ?? 0}</td>
                    <td className="py-2 text-center text-neutral-400">{pointsByUser.get(u.id) ?? 0}</td>
                    <td className="py-2 text-neutral-400">{fmtDate(u.created_at)}</td>
                    <td className="py-2 text-right">
                      {isMe ? (
                        <span className="text-xs text-neutral-600">tú</span>
                      ) : (
                        <AdminDeleteButton action={adminDeleteUser.bind(null, u.id)} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gestión del torneo */}
      <section className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold">Torneo</h2>

        <AdminTopScorer players={players ?? []} />

        <AdminChampion teams={teams} />

        <p className="text-sm text-neutral-400">
          Activa los partidos para habilitar las predicciones e ingresa
          resultados manualmente si la API no los provee.
        </p>

        {allMatches.length === 0 ? (
          <p className="text-neutral-400">
            No hay partidos cargados. Usa el botón &quot;Cargar partidos&quot; de arriba.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {ROUNDS.filter((r) => r !== "group_stage").map((round) => {
              const roundMatches = allMatches.filter((m) => m.round === round);
              if (roundMatches.length === 0) return null;
              const allActive = roundMatches.every((m) => m.is_active);
              return (
                <div key={round} className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-neutral-300">{ROUND_LABELS[round] ?? round}</h3>
                    {!allActive && (
                      <AdminRoundActivator round={round} label={ROUND_LABELS[round] ?? round} />
                    )}
                  </div>
                  {roundMatches.map((match) => (
                    <AdminMatchRow
                      key={match.id}
                      matchId={match.id}
                      homeTeam={match.home_team}
                      awayTeam={match.away_team}
                      isKnockout={isKnockoutRound(match.round as Round)}
                      isActive={match.is_active}
                      status={match.status as MatchStatus}
                      homeScore={match.home_score}
                      awayScore={match.away_score}
                      winner={match.winner as MatchWinner | null}
                    />
                  ))}
                </div>
              );
            })}

            <div className="flex flex-col gap-3">
              <h3 className="font-semibold text-neutral-300">Fase de grupos</h3>
              {allMatches
                .filter((m) => m.round === "group_stage")
                .map((match) => (
                  <AdminMatchRow
                    key={match.id}
                    matchId={match.id}
                    homeTeam={match.home_team}
                    awayTeam={match.away_team}
                    isKnockout={false}
                    isActive={match.is_active}
                    status={match.status as MatchStatus}
                    homeScore={match.home_score}
                    awayScore={match.away_score}
                    winner={match.winner as MatchWinner | null}
                  />
                ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
