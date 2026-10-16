"use client";

import { useMemo, useState, useTransition } from "react";
import type { FormatDefinition, ResolvedMatch } from "@/lib/engine";
import { stageRules } from "@/lib/engine";
import { StatusPill } from "@/components/StageView";
import { saveResult, saveSchedule } from "@/app/admin/actions";
import type { ScheduleRow } from "@/lib/data";
import { parseSetInputs } from "@/lib/sets-input";

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
        <h2 className="font-semibold text-navy-900">Resultados y programación</h2>
        <div className="inline-flex rounded-xl bg-navy-50 p-1 text-sm">
          {(
            [
              ["pending", "Por jugarse"],
              ["finished", "Finalizados"],
              ["all", "Todos"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              aria-pressed={filter === k}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors duration-150 ${filter === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-400 hover:text-navy-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="mt-4 space-y-3">
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
        {shown.length === 0 && <li className="text-sm text-navy-400">No hay partidos en esta lista.</li>}
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
    const parsed = parseSetInputs(sets);
    if ("error" in parsed) return setMsg({ ok: false, text: parsed.error });
    run(() => saveResult(categoryId, m.key, { sets: parsed.sets }), "Guardado");
  };

  return (
    <li
      className={`rounded-xl border p-4 text-sm transition-colors duration-150 ${m.status === "ready" ? "border-sky-200 bg-sky-50/30" : "border-navy-100/70 bg-white"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-navy-400">
        <span>
          <span className="font-semibold text-navy-600">P{m.number}</span> · {m.label}
        </span>
        <StatusPill status={m.status} />
      </div>

      <div className="mt-2 grid gap-3 lg:grid-cols-[1fr_auto]">
        <table className="text-sm">
          <tbody>
            {(["a", "b"] as const).map((side) => (
              <tr key={side}>
                <td
                  className={`py-0.5 pr-3 ${m.winner && m.winner === (side === "a" ? m.teamA : m.teamB) ? "font-semibold text-navy-950" : "text-navy-800"}`}
                >
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

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy-50 pt-3">
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

      {msg && <p role="status" className={`mt-2 text-xs font-medium ${msg.ok ? "text-sky-700" : "text-red-600"}`}>{msg.ok ? "✓ " : ""}{msg.text}</p>}
    </li>
  );
}
