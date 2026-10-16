"use client";

import { useMemo, useState, useTransition } from "react";
import {
  TEMPLATES,
  generateFormat,
  resolveTournament,
  type FormatDefinition,
  type TeamRef,
  type TemplateOptions,
} from "@/lib/engine";
import { StageView, makeDescribe } from "@/components/StageView";
import { saveFormat } from "@/app/admin/actions";

/** Elegir plantilla → ajustar → (opcional) editar la definición a mano → previsualizar → guardar. */
export function FormatBuilder({ categoryId, teams }: { categoryId: string; teams: TeamRef[] }) {
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [options, setOptions] = useState<Omit<TemplateOptions, "teams">>({
    groups: Math.max(1, Math.round(teams.length / 4)),
    qualifyPerGroup: 2,
    bestNext: 0,
    thirdPlace: true,
    grandFinalReset: false,
    doubleRound: false,
    seeding: "serpentine",
  });
  const [customJson, setCustomJson] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const template = TEMPLATES.find((t) => t.id === templateId)!;

  const set = <K extends keyof typeof options>(k: K, v: (typeof options)[K]) => {
    setCustomJson(null);
    setOptions((o) => ({ ...o, [k]: v }));
  };

  const preview = useMemo(() => {
    try {
      const format: FormatDefinition = customJson
        ? JSON.parse(customJson)
        : template.build({ ...options, teams: teams.length });
      const gen = generateFormat(format);
      const state = resolveTournament(format, gen, teams, {});
      return { format, gen, state, err: null };
    } catch (e) {
      return { format: null, gen: null, state: null, err: (e as Error).message };
    }
  }, [customJson, template, options, teams]);

  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? "—";

  const save = () =>
    start(async () => {
      if (!preview.format) return;
      const r = await saveFormat(categoryId, JSON.stringify(preview.format));
      setError(r.ok ? null : r.error);
    });

  const num = (label: string, k: "groups" | "qualifyPerGroup" | "bestNext", min: number) => (
    <label className="block text-sm">
      <span className="mb-1 block text-gray-700">{label}</span>
      <input type="number" min={min} className="input" value={options[k]} onChange={(e) => set(k, Math.max(min, Number(e.target.value)))} />
    </label>
  );
  const check = (label: string, k: "thirdPlace" | "grandFinalReset" | "doubleRound") => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={!!options[k]} onChange={(e) => set(k, e.target.checked)} />
      {label}
    </label>
  );

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-semibold">Formato</h2>
        <p className="text-sm text-gray-500">
          Con {teams.length} duplas. Elige una plantilla y ajústala; todo queda editable en la definición.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-gray-700">Plantilla</span>
          <select
            className="input"
            value={templateId}
            onChange={(e) => {
              setCustomJson(null);
              setTemplateId(e.target.value);
            }}
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-gray-500">{template.description}</span>
        </label>
        {template.uses.includes("groups") && num("Grupos", "groups", 1)}
        {template.uses.includes("qualifyPerGroup") && num("Clasifican por grupo", "qualifyPerGroup", 1)}
        {template.uses.includes("bestNext") && num("Mejores del siguiente puesto", "bestNext", 0)}
        {template.uses.includes("seeding") && (
          <label className="block text-sm">
            <span className="mb-1 block text-gray-700">Siembra en grupos</span>
            <select className="input" value={options.seeding} onChange={(e) => set("seeding", e.target.value as TemplateOptions["seeding"])}>
              <option value="serpentine">Serpentina</option>
              <option value="sequential">Secuencial</option>
              <option value="random">Sorteo por bombos</option>
            </select>
          </label>
        )}
        <div className="space-y-1 self-end">
          {template.uses.includes("thirdPlace") && check("Partido por 3er puesto", "thirdPlace")}
          {template.uses.includes("grandFinalReset") && check("Final de desempate", "grandFinalReset")}
          {template.uses.includes("doubleRound") && check("Ida y vuelta", "doubleRound")}
        </div>
      </div>

      <details>
        <summary className="cursor-pointer text-sm font-medium">Editar definición a mano (avanzado)</summary>
        <textarea
          className="mt-2 h-72 w-full rounded-lg border p-2 font-mono text-xs"
          value={customJson ?? (preview.format ? JSON.stringify(preview.format, null, 2) : "")}
          onChange={(e) => setCustomJson(e.target.value)}
        />
        {customJson && (
          <button className="text-xs text-sky-700 underline" onClick={() => setCustomJson(null)}>
            Volver a la plantilla
          </button>
        )}
      </details>

      {preview.err && <p className="text-sm text-red-600">No se puede generar: {preview.err}</p>}
      {preview.gen && preview.state && preview.format && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-600">
              {preview.gen.matches.length} partidos · {preview.gen.groups.length} grupos · {preview.format.stages.length} fases
            </span>
            <button className="btn-primary" disabled={pending} onClick={save}>
              {pending ? "Guardando…" : "Guardar y generar partidos"}
            </button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
          <div className="space-y-4">
            {preview.format.stages.map((s) => (
              <StageView
                key={s.key}
                stage={s}
                gen={preview.gen!}
                state={preview.state!}
                helpers={{ teamName, describe: makeDescribe(preview.gen!, teamName) }}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
