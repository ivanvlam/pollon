"use client";

import { useMemo, useState, useTransition } from "react";

import { Flag } from "@/components/Flag";
import { Button } from "@/components/ui/Button";
import { upsertManualMatch, type ManualMatchInput } from "@/lib/admin/actions";
import { ROUND_LABELS } from "@/lib/labels";
import { toSpanish } from "@/lib/teamNames";

type KoRound = ManualMatchInput["round"];

const KO_ROUNDS: KoRound[] = [
  "round_of_32",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "third_place",
  "final",
];

interface Props {
  /** Equipos elegibles (nombres en inglés, como están en la DB). */
  teams: string[];
}

/**
 * Form del admin para cargar a mano un partido de eliminatoria (fallback cuando
 * TheSportsDB aún no publicó el cruce). Los equipos salen de un dropdown con los
 * clasificados reales para que los nombres coincidan exactos con la DB. El
 * horario se ingresa en hora local y se envía en ISO UTC.
 */
export function AdminKnockoutEditor({ teams }: Props) {
  const [round, setRound] = useState<KoRound>("round_of_32");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [kickoff, setKickoff] = useState(""); // datetime-local (hora local)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const options = useMemo(
    () =>
      [...teams]
        .map((t) => ({ value: t, label: toSpanish(t) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [teams],
  );

  function submit() {
    setMsg(null);
    if (!home || !away || !kickoff) {
      setMsg({ ok: false, text: "Completá equipos y horario" });
      return;
    }
    // datetime-local → ISO UTC (se interpreta en la zona del navegador).
    const iso = new Date(kickoff).toISOString();
    startTransition(async () => {
      const r = await upsertManualMatch({
        round,
        homeTeam: home,
        awayTeam: away,
        kickoffAt: iso,
      });
      if (r.ok) {
        setMsg({ ok: true, text: "✓ Partido creado (queda inactivo hasta activarlo)" });
        setHome("");
        setAway("");
        setKickoff("");
      } else {
        setMsg({ ok: false, text: r.error });
      }
    });
  }

  const selectCls =
    "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-600";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-neutral-300">Cargar partido manual</h3>
        <span className="text-xs text-neutral-500">Fallback si la API no lo trae</span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Ronda
          <select className={selectCls} value={round} onChange={(e) => setRound(e.target.value as KoRound)}>
            {KO_ROUNDS.map((r) => (
              <option key={r} value={r}>
                {ROUND_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Horario (tu hora local)
          <input
            type="datetime-local"
            className={selectCls}
            value={kickoff}
            onChange={(e) => setKickoff(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Local
          <div className="flex items-center gap-2">
            {home && <Flag team={home} className="h-5 w-7 shrink-0" />}
            <select className={selectCls} value={home} onChange={(e) => setHome(e.target.value)}>
              <option value="">—</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="flex flex-col gap-1 text-xs text-neutral-400">
          Visitante
          <div className="flex items-center gap-2">
            {away && <Flag team={away} className="h-5 w-7 shrink-0" />}
            <select className={selectCls} value={away} onChange={(e) => setAway(e.target.value)}>
              <option value="">—</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={submit} disabled={pending}>
          {pending ? "Guardando…" : "Crear partido"}
        </Button>
        {msg && (
          <span className={`text-sm ${msg.ok ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</span>
        )}
      </div>
    </div>
  );
}
