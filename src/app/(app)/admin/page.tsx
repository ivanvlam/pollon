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
import type { MatchWinner, Round } from "@/types";

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
    { count: predCount },
    { data: matches },
    { data: players },
  ] = await Promise.all([
    svc.from("profiles").select("id, display_name, created_at"),
    svc.from("pools").select("id, name, created_at, created_by"),
    svc.from("pool_members").select("pool_id, user_id"),
    svc.from("scores").select("pool_id"),
    svc.from("predictions").select("*", { count: "exact", head: true }),
    svc
      .from("matches")
      .select("id, round, home_team, away_team, kickoff_at, is_active, home_score, away_score, winner")
      .order("kickoff_at", { ascending: true }),
    svc.from("players").select("name, team").order("name"),
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

  const avgPoolsPerUser = userCount ? (membershipCount / userCount).toFixed(1) : "0";
  const avgMembersPerPool = poolCount ? (membershipCount / poolCount).toFixed(1) : "0";
  const usersWithoutPool = allProfiles.filter((p) => !poolsByUser.has(p.id)).length;
  const activePools = allPools.filter((p) => poolsWithScores.has(p.id)).length;

  const poolsSorted = [...allPools].sort((a, b) => a.name.localeCompare(b.name));
  const usersSorted = [...allProfiles].sort((a, b) =>
    (a.display_name ?? "").localeCompare(b.display_name ?? ""),
  );

  const teams = [
    ...new Set((matches ?? []).flatMap((m) => [m.home_team, m.away_team])),
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
          <Stat label="Predicciones" value={predCount ?? 0} />
          <Stat label="Membresías totales" value={membershipCount} />
          <Stat label="Pollas por usuario (prom.)" value={avgPoolsPerUser} />
          <Stat label="Participantes por polla (prom.)" value={avgMembersPerPool} />
          <Stat label="Pollas con puntos" value={activePools} />
          <Stat label="Usuarios sin polla" value={usersWithoutPool} />
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="border-b border-neutral-800 text-neutral-400">
              <tr>
                <th scope="col" className="py-2">Nombre</th>
                <th scope="col" className="py-2">Email</th>
                <th scope="col" className="py-2 text-center">Pollas</th>
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

        {!matches || matches.length === 0 ? (
          <p className="text-neutral-400">
            No hay partidos cargados. Usa el botón &quot;Cargar partidos&quot; de arriba.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {ROUNDS.filter((r) => r !== "group_stage").map((round) => {
              const roundMatches = matches.filter((m) => m.round === round);
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
              {matches
                .filter((m) => m.round === "group_stage")
                .map((match) => (
                  <AdminMatchRow
                    key={match.id}
                    matchId={match.id}
                    homeTeam={match.home_team}
                    awayTeam={match.away_team}
                    isKnockout={false}
                    isActive={match.is_active}
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
