"use client";

import { useMemo, useState } from "react";
import {
  TEMPLATES,
  generateFormat,
  resolveTournament,
  type FormatDefinition,
  type TeamRef,
  type TemplateOptions,
} from "@/lib/engine";
import { simulateTournament } from "@/lib/engine/simulate";
import { StageView, makeDescribe } from "@/components/StageView";

const DEFAULT_OPTIONS: TemplateOptions = {
  teams: 16,
  groups: 4,
  qualifyPerGroup: 2,
  bestNext: 0,
  thirdPlace: true,
  grandFinalReset: false,
  doubleRound: false,
  seeding: "serpentine",
};


export default function FormatosPage() {
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [options, setOptions] = useState<TemplateOptions>(DEFAULT_OPTIONS);
  const [customJson, setCustomJson] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [simulate, setSimulate] = useState(true);
  const [simSeed, setSimSeed] = useState(7);

  const template = TEMPLATES.find((t) => t.id === templateId)!;

  const format: FormatDefinition = useMemo(() => {
    if (customJson) {
      try {
        return JSON.parse(customJson) as FormatDefinition;
      } catch {
        /* se avisa en el editor */
      }
    }
    return template.build(options);
  }, [customJson, template, options]);

  const teams: TeamRef[] = useMemo(
    () => Array.from({ length: options.teams }, (_, i) => ({ id: `T${i + 1}`, name: `Dupla ${i + 1}`, seed: i + 1 })),
    [options.teams],
  );

  const { gen, state, error } = useMemo(() => {
    try {
      const gen = generateFormat(format);
      const state = simulate
        ? simulateTournament(format, gen, teams, simSeed).state
        : resolveTournament(format, gen, teams, {});
      return { gen, state, error: null };
    } catch (e) {
      return { gen: null, state: null, error: (e as Error).message };
    }
  }, [format, teams, simulate, simSeed]);

  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name ?? "—";
  const describe = gen ? makeDescribe(gen, teamName) : () => "";

  const set = <K extends keyof TemplateOptions>(k: K, v: TemplateOptions[K]) => {
    setCustomJson(null);
    setOptions((o) => ({ ...o, [k]: v }));
  };

  const champion = (() => {
    if (!state) return null;
    const last = format.stages[format.stages.length - 1];
    const podium = state.placements[last.key] ?? state.placements[`${last.key}-A`];
    return podium?.[0] ? podium : null;
  })();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">Laboratorio de formatos</h1>
      <p className="text-gray-600">
        Elige una plantilla, ajústala o edita la definición a mano. Los partidos, grupos y llaves se generan solos.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ── Panel de configuración ── */}
        <aside className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
          <Field label="Plantilla">
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
            <p className="mt-1 text-xs text-gray-500">{template.description}</p>
          </Field>

          <Field label="Duplas inscritas">
            <input className="input" type="number" min={2} max={64} value={options.teams}
              onChange={(e) => set("teams", Math.max(2, Number(e.target.value)))} />
          </Field>
          {template.uses.includes("groups") && (
            <Field label="Número de grupos">
              <input className="input" type="number" min={1} max={16} value={options.groups}
                onChange={(e) => set("groups", Math.max(1, Number(e.target.value)))} />
            </Field>
          )}
          {template.uses.includes("qualifyPerGroup") && (
            <Field label="Clasifican por grupo">
              <input className="input" type="number" min={1} max={4} value={options.qualifyPerGroup}
                onChange={(e) => set("qualifyPerGroup", Math.max(1, Number(e.target.value)))} />
            </Field>
          )}
          {template.uses.includes("bestNext") && (
            <Field label="Además, mejores del siguiente puesto">
              <input className="input" type="number" min={0} max={8} value={options.bestNext}
                onChange={(e) => set("bestNext", Math.max(0, Number(e.target.value)))} />
            </Field>
          )}
          {template.uses.includes("seeding") && (
            <Field label="Siembra en grupos">
              <select className="input" value={options.seeding}
                onChange={(e) => set("seeding", e.target.value as TemplateOptions["seeding"])}>
                <option value="serpentine">Serpentina (por ranking)</option>
                <option value="sequential">Secuencial</option>
                <option value="random">Sorteo por bombos</option>
              </select>
            </Field>
          )}
          {template.uses.includes("thirdPlace") && (
            <Check label="Partido por 3er puesto" checked={!!options.thirdPlace} onChange={(v) => set("thirdPlace", v)} />
          )}
          {template.uses.includes("grandFinalReset") && (
            <Check label="Final de desempate (si gana el de perdedores)" checked={!!options.grandFinalReset}
              onChange={(v) => set("grandFinalReset", v)} />
          )}
          {template.uses.includes("doubleRound") && (
            <Check label="Ida y vuelta" checked={!!options.doubleRound} onChange={(v) => set("doubleRound", v)} />
          )}

          <hr />
          <Check label="Simular resultados" checked={simulate} onChange={setSimulate} />
          {simulate && (
            <button className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-gray-50" onClick={() => setSimSeed((s) => s + 1)}>
              Otros resultados al azar
            </button>
          )}

          <details>
            <summary className="cursor-pointer text-sm font-semibold">Definición (editable)</summary>
            <textarea
              className="mt-2 h-80 w-full rounded-lg border p-2 font-mono text-xs"
              value={customJson ?? JSON.stringify(format, null, 2)}
              onChange={(e) => {
                setCustomJson(e.target.value);
                try {
                  JSON.parse(e.target.value);
                  setJsonError(null);
                } catch (err) {
                  setJsonError((err as Error).message);
                }
              }}
            />
            {jsonError && <p className="text-xs text-red-600">JSON inválido: {jsonError}</p>}
            {customJson && (
              <button className="mt-1 text-xs text-sky-700 underline" onClick={() => { setCustomJson(null); setJsonError(null); }}>
                Volver a la plantilla
              </button>
            )}
          </details>
        </aside>

        {/* ── Resultado ── */}
        <section className="min-w-0 space-y-6">
          {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">Error al generar: {error}</p>}
          {gen && state && (
            <>
              <div className="flex flex-wrap gap-3 text-sm">
                <Stat label="Partidos" value={gen.matches.length} />
                <Stat label="Grupos" value={gen.groups.length} />
                <Stat label="Fases" value={format.stages.length} />
                {champion && (
                  <div className="rounded-lg bg-amber-100 px-4 py-2 font-semibold text-amber-900">
                    🏆 {teamName(champion[0])}
                    {champion[1] && <span className="font-normal"> · 🥈 {teamName(champion[1])}</span>}
                    {champion[2] && <span className="font-normal"> · 🥉 {teamName(champion[2])}</span>}
                  </div>
                )}
              </div>

              {format.stages.map((stage) => (
                <StageView key={stage.key} stage={stage} gen={gen} state={state} helpers={{ teamName, describe }} />
              ))}
            </>
          )}
        </section>
      </div>

    </main>
  );
}


function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-4 py-2 shadow-sm">
      <span className="text-gray-500">{label}: </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
