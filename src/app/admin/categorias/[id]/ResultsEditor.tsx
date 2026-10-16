"use client";

import { useMemo, useState, useTransition } from "react";
import type { FormatDefinition, ResolvedMatch } from "@/lib/engine";
import { stageRules } from "@/lib/engine";
import { STATUS_LABEL, STATUS_STYLE } from "@/components/StageView";
import { saveResult, saveSchedule } from "@/app/admin/actions";
import type { ScheduleRow } from "@/lib/data";

type Filter = "pending" | "all" | "finished";

export function ResultsEditor({
  categoryId,
  format,
  matches,
  teamNames,
  describe,
  schedule,
}: {
  categoryId: string;
  format: FormatDefinition;
  matches: ResolvedMatch[];
  teamNames: Record<string, string>;
  describe: Record<string, { a: string; b: string }>;
  schedule: Record<string, ScheduleRow>;
}) {
  const [filter, setFilter] = useState<Filter>("pending");
  const shown = useMemo(
    () =>
      matches.filter((m) =>
        filter === "all" ? true : filter === "finished" ? m.status === "finished" : m.status === "ready",
      ),
    [matches, filter],
  );

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Resultados y programación</h2>
        <div className="flex gap-1 text-sm">
          {(
            [
              ["pending", "Por jugarse"],
              ["finished", "Finalizados"],
              ["all", "Todos"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className={filter === k ? "btn-primary px-3 py-1" : "btn"}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {shown.map((m) => (
          <MatchEditor
            key={`${m.key}-${JSON.stringify(m.result)}-${m.teamA}-${m.teamB}`}
            categoryId={categoryId}
            match={m}
            setsToWin={stageRules(format, format.stages.find((s) => s.key === m.stageKey)!).match.setsToWin}
            nameA={m.teamA ? teamNames[m.teamA] : describe[m.key]?.a}
            nameB={m.teamB ? teamNames[m.teamB] : describe[m.key]?.b}
            schedule={schedule[m.key]}
          />
        ))}
        {shown.length === 0 && <li className="text-sm text-gray-500">No hay partidos en esta lista.</li>}
      </ul>
    </section>
  );
}

const toLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function MatchEditor({
  categoryId,
  match: m,
  setsToWin,
  nameA,
  nameB,
  schedule,
}: {
  categoryId: string;
  match: ResolvedMatch;
  setsToWin: number;
  nameA?: string;
  nameB?: string;
  schedule?: ScheduleRow;
}) {
  const maxSets = setsToWin * 2 - 1;
  const initial = Array.from({ length: maxSets }, (_, i) => ({
    a: m.result?.sets[i]?.a?.toString() ?? "",
    b: m.result?.sets[i]?.b?.toString() ?? "",
  }));
  const [sets, setSets] = useState(initial);
  const [wo, setWo] = useState(m.result?.walkoverWinner ?? "");
  const [court, setCourt] = useState(schedule?.court ?? "");
  const [when, setWhen] = useState(toLocalInput(schedule?.scheduled_at));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const playable = Boolean(m.teamA && m.teamB) && m.status !== "cancelled";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okText: string) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "Error" });
    });

  const submitResult = () => {
    if (wo) return run(() => saveResult(categoryId, m.key, { sets: [], walkoverWinner: wo }), "Guardado");
    const filled = sets
      .filter((s) => s.a !== "" || s.b !== "")
      .map((s) => ({ a: Number(s.a), b: Number(s.b) }));
    run(() => saveResult(categoryId, m.key, { sets: filled }), "Guardado");
  };

  return (
    <li className="rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>
          P{m.number} · {m.label}
        </span>
        <span className={`rounded px-1.5 py-0.5 ${STATUS_STYLE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
      </div>

      <div className="mt-2 grid gap-3 lg:grid-cols-[1fr_auto]">
        <table className="text-sm">
          <tbody>
            {(["a", "b"] as const).map((side) => (
              <tr key={side}>
                <td className={`pr-3 ${m.winner && m.winner === (side === "a" ? m.teamA : m.teamB) ? "font-bold" : ""}`}>
                  {(side === "a" ? nameA : nameB) ?? "—"}
                </td>
                {sets.map((s, i) => (
                  <td key={i} className="px-0.5">
                    <input
                      inputMode="numeric"
                      aria-label={`Set ${i + 1} ${side === "a" ? nameA : nameB}`}
                      disabled={!playable || !!wo}
                      className="input w-12 px-1 text-center"
                      value={s[side]}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        setSets((prev) => prev.map((x, j) => (j === i ? { ...x, [side]: v } : x)));
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto" value={wo} disabled={!playable} onChange={(e) => setWo(e.target.value)} aria-label="W.O.">
            <option value="">Sin W.O.</option>
            {m.teamA && <option value={m.teamA}>W.O. gana {nameA}</option>}
            {m.teamB && <option value={m.teamB}>W.O. gana {nameB}</option>}
          </select>
          <button className="btn-primary" disabled={!playable || pending} onClick={submitResult}>
            Guardar resultado
          </button>
          {m.result && (
            <button
              className="btn-danger"
              disabled={pending}
              onClick={() => window.confirm("¿Borrar el resultado de este partido?") && run(() => saveResult(categoryId, m.key, null), "Resultado borrado")}
            >
              Borrar
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input className="input w-36" placeholder="Cancha" value={court} onChange={(e) => setCourt(e.target.value)} aria-label="Cancha" />
        <input type="datetime-local" className="input w-auto" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Fecha y hora" />
        <button
          className="btn"
          disabled={pending}
          onClick={() => run(() => saveSchedule(categoryId, m.key, court, when ? new Date(when).toISOString() : null), "Programación guardada")}
        >
          Guardar programación
        </button>
      </div>

      {msg && <p className={`mt-1 text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
    </li>
  );
}
