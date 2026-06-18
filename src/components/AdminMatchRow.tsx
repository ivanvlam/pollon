"use client";

import { useState, useTransition } from "react";

import { Flag } from "@/components/Flag";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { adminUpsertPrediction, saveMatchResult, setMatchActive } from "@/lib/admin/actions";
import type { MatchStatus, MatchWinner } from "@/types";

interface Props {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  isKnockout: boolean;
  isActive: boolean;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  winner: MatchWinner | null;
  /** El partido está cerrado o en vivo (no terminado): habilita predecir como admin. */
  canAdminPredict?: boolean;
  /** Predicción actual del admin para prellenar. */
  myPredHome?: number | null;
  myPredAway?: number | null;
  myPredWinner?: MatchWinner | null;
}

export function AdminMatchRow({
  matchId,
  homeTeam,
  awayTeam,
  isKnockout,
  isActive,
  status,
  homeScore,
  awayScore,
  winner,
  canAdminPredict = false,
  myPredHome = null,
  myPredAway = null,
  myPredWinner = null,
}: Props) {
  const [home, setHome] = useState(homeScore?.toString() ?? "");
  const [away, setAway] = useState(awayScore?.toString() ?? "");
  const [win, setWin] = useState<MatchWinner | "">(winner ?? "");
  const [msg, setMsg] = useState("");
  const [pending, startTransition] = useTransition();

  // Predicción del admin (bypass de cierre).
  const [predHome, setPredHome] = useState(myPredHome?.toString() ?? "");
  const [predAway, setPredAway] = useState(myPredAway?.toString() ?? "");
  const [predWin, setPredWin] = useState<MatchWinner | "">(myPredWinner ?? "");
  const [predMsg, setPredMsg] = useState("");
  const [predPending, startPredTransition] = useTransition();

  function savePrediction() {
    startPredTransition(async () => {
      const r = await adminUpsertPrediction(matchId, {
        predictedHome: Number(predHome),
        predictedAway: Number(predAway),
        predictedWinner: isKnockout ? (predWin === "" ? null : predWin) : null,
      });
      setPredMsg(r.ok ? "Predicción guardada ✓" : r.error);
    });
  }

  // Empate a 90' en eliminatoria → se definió por penales y la API gratuita
  // no entrega el clasificado: necesita que el admin lo marque a mano.
  const needsQualifier =
    isKnockout &&
    status === "finished" &&
    winner === null &&
    homeScore !== null &&
    awayScore !== null &&
    homeScore === awayScore;

  function toggleActive() {
    startTransition(async () => {
      const r = await setMatchActive(matchId, !isActive);
      setMsg(r.ok ? "" : r.error);
    });
  }

  function save() {
    startTransition(async () => {
      const r = await saveMatchResult(matchId, {
        homeScore: Number(home),
        awayScore: Number(away),
        winner: isKnockout ? (win === "" ? null : win) : null,
      });
      setMsg(r.ok ? "Guardado ✓" : r.error);
    });
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-3 ${
        needsQualifier ? "border-amber-500/60 bg-amber-500/5" : "border-neutral-800"
      }`}
    >
      {needsQualifier && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
          ⚠️ Empate a 90&apos; — falta marcar quién clasificó (penales)
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Flag team={homeTeam} />
          {homeTeam} <span className="text-neutral-500">vs</span> {awayTeam}
          <Flag team={awayTeam} />
        </span>
        <div className="flex items-center gap-2">
          <Button
            onClick={toggleActive}
            disabled={pending}
            size="sm"
            variant={isActive ? "secondary" : "ghost"}
            className={isActive ? "border-emerald-600/50 text-emerald-400" : ""}
          >
            {isActive ? "Activo" : "Inactivo"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={0}
          max={99}
          value={home}
          aria-label={`Goles de ${homeTeam}`}
          onChange={(e) => setHome(e.target.value)}
          className="w-14 text-center"
        />
        <span className="text-neutral-500">–</span>
        <Input
          type="number"
          min={0}
          max={99}
          value={away}
          aria-label={`Goles de ${awayTeam}`}
          onChange={(e) => setAway(e.target.value)}
          className="w-14 text-center"
        />

        {isKnockout && (
          <select
            value={win}
            aria-label="Quién clasifica"
            onChange={(e) => setWin(e.target.value as MatchWinner | "")}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500"
          >
            <option value="">Clasifica…</option>
            <option value="home">{homeTeam}</option>
            <option value="away">{awayTeam}</option>
          </select>
        )}

        <Button
          onClick={save}
          disabled={pending || home === "" || away === ""}
          size="sm"
        >
          Guardar resultado
        </Button>
      </div>

      {msg && <p className="text-xs text-neutral-400">{msg}</p>}

      {canAdminPredict && (
        <div className="flex flex-col gap-2 rounded-lg border border-sky-500/40 bg-sky-500/5 p-3">
          <p className="text-xs font-medium text-sky-400">
            Tu predicción (admin) — saltándose el cierre
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={0}
              max={99}
              value={predHome}
              aria-label={`Tu predicción de goles de ${homeTeam}`}
              onChange={(e) => setPredHome(e.target.value)}
              className="w-14 text-center"
            />
            <span className="text-neutral-500">–</span>
            <Input
              type="number"
              min={0}
              max={99}
              value={predAway}
              aria-label={`Tu predicción de goles de ${awayTeam}`}
              onChange={(e) => setPredAway(e.target.value)}
              className="w-14 text-center"
            />

            {isKnockout && (
              <select
                value={predWin}
                aria-label="Tu predicción de quién clasifica"
                onChange={(e) => setPredWin(e.target.value as MatchWinner | "")}
                className="rounded-lg border border-neutral-700 bg-neutral-900 px-2 py-2 text-sm text-neutral-100 outline-none focus:border-sky-500"
              >
                <option value="">Clasifica…</option>
                <option value="home">{homeTeam}</option>
                <option value="away">{awayTeam}</option>
              </select>
            )}

            <Button
              onClick={savePrediction}
              disabled={predPending || predHome === "" || predAway === ""}
              size="sm"
              variant="secondary"
            >
              Guardar predicción
            </Button>
          </div>
          {predMsg && <p className="text-xs text-neutral-400">{predMsg}</p>}
        </div>
      )}
    </div>
  );
}
