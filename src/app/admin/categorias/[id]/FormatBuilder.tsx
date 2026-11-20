"use client";

import { useMemo, useState, useTransition } from "react";
import {
  TEMPLATES,
  applyMatchRules,
  describeMatchRules,
  generateFormat,
  resolveTournament,
  type FormatDefinition,
  type MatchMode,
  type MatchRules,
  type TeamRef,
  type TemplateOptions,
  validateFormat,
} from "@/lib/engine";
import { StageView, makeDescribe } from "@/components/StageView";
import { saveFormat } from "@/app/admin/actions";

const DEFAULT_MODE: MatchMode = {
  setsToWin: 2,
  setPoints: 21,
  decidingSetPoints: 15,
};
const modeOf = (m?: Partial<MatchRules>): MatchMode => ({
  ...DEFAULT_MODE,
  ...m,
});

/**
 * Elegir plantilla → ajustar → (opcional) editar la definición a mano → previsualizar → guardar.
 * Con `existing` funciona como editor del formato ya guardado (también con resultados cargados:
 * el servidor conserva los que sigan valiendo y avisa si alguno queda en conflicto).
 */
export function FormatBuilder({
  categoryId,
  teams,
  existing,
  results = 0,
}: {
  categoryId: string;
  teams: TeamRef[];
  existing?: FormatDefinition;
  results?: number;
}) {
  // En modo edición se parte del formato actual ("existing"); se puede cambiar a una plantilla.
  const [templateId, setTemplateId] = useState(
    existing ? "existing" : TEMPLATES[0].id,
  );
  const lastOverride =
    existing?.stages[existing.stages.length - 1]?.rules?.match;
  const [mainMode, setMainMode] = useState<MatchMode>(
    modeOf(existing?.rules.match),
  );
  const [finalMode, setFinalMode] = useState<MatchMode | null>(
    lastOverride ? modeOf({ ...existing!.rules.match, ...lastOverride }) : null,
  );
  const [saved, setSaved] = useState<string | null>(null);
  // Si nadie toca el tipo de partido, el formato actual se guarda tal cual (conserva reglas propias de cada fase).
  const [modeTouched, setModeTouched] = useState(false);
  const customStageRules =
    existing?.stages.slice(0, -1).some((st) => st.rules?.match) ?? false;
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
  const template = TEMPLATES.find((t) => t.id === templateId) ?? null;

  const set = <K extends keyof typeof options>(
    k: K,
    v: (typeof options)[K],
  ) => {
    setCustomJson(null);
    setOptions((o) => ({ ...o, [k]: v }));
  };

  const preview = useMemo(() => {
    try {
      // La definición escrita a mano manda tal cual; si no, plantilla (o formato actual) + tipo de partido.
      const format: FormatDefinition = customJson
        ? JSON.parse(customJson)
        : !template && !modeTouched
          ? existing!
          : applyMatchRules(
              template
                ? template.build({ ...options, teams: teams.length })
                : existing!,
              mainMode,
              finalMode,
            );
      const gen = generateFormat(format);
      const state = resolveTournament(format, gen, teams, {});
      return {
        format,
        gen,
        state,
        err: null,
        problems: validateFormat(format, teams.length),
      };
    } catch (e) {
      return {
        format: null,
        gen: null,
        state: null,
        err: (e as Error).message,
        problems: [] as string[],
      };
    }
  }, [
    customJson,
    template,
    options,
    teams,
    existing,
    mainMode,
    finalMode,
    modeTouched,
  ]);

  const teamName = (id: string | null) =>
    teams.find((t) => t.id === id)?.name ?? "—";

  const save = () =>
    start(async () => {
      if (!preview.format) return;
      const r = await saveFormat(categoryId, JSON.stringify(preview.format));
      setError(r.ok ? null : r.error);
      setSaved(r.ok ? (r.message ?? "Guardado") : null);
    });

  const num = (
    label: string,
    k: "groups" | "qualifyPerGroup" | "bestNext",
    min: number,
  ) => (
    <label className="block text-sm">
      <span className="mb-1 block text-navy-700">{label}</span>
      <input
        type="number"
        min={min}
        className="input"
        value={options[k]}
        onChange={(e) => set(k, Math.max(min, Number(e.target.value)))}
      />
    </label>
  );
  const check = (
    label: string,
    k: "thirdPlace" | "grandFinalReset" | "doubleRound",
  ) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={!!options[k]}
        onChange={(e) => set(k, e.target.checked)}
      />
      {label}
    </label>
  );

  return (
    <section className={existing ? "space-y-4" : "card space-y-4"}>
      <div>
        {!existing && <h2 className="font-semibold text-navy-900">Formato</h2>}
        <p className="text-sm text-navy-400">
          {existing
            ? results > 0
              ? `Hay ${results} resultados cargados: se conservan si siguen valiendo con el cambio (mismo partido, mismas duplas y marcador válido).`
              : "Todavía no hay resultados: puedes cambiar lo que quieras."
            : `Con ${teams.length} duplas. Elige una plantilla y ajústala; todo queda editable en la definición.`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-navy-700">Plantilla</span>
          <select
            className="input"
            value={templateId}
            onChange={(e) => {
              setCustomJson(null);
              setTemplateId(e.target.value);
            }}
          >
            {existing && (
              <option value="existing">
                Formato actual (sin cambiar la estructura)
              </option>
            )}
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-navy-400">
            {template
              ? template.description
              : "Se mantienen fases, grupos y llaves; puedes cambiar el tipo de partido."}
          </span>
        </label>
        {template?.uses.includes("groups") && num("Grupos", "groups", 1)}
        {template?.uses.includes("qualifyPerGroup") &&
          num("Clasifican por grupo", "qualifyPerGroup", 1)}
        {template?.uses.includes("bestNext") &&
          num("Mejores del siguiente puesto", "bestNext", 0)}
        {template?.uses.includes("seeding") && (
          <label className="block text-sm">
            <span className="mb-1 block text-navy-700">Siembra en grupos</span>
            <select
              className="input"
              value={options.seeding}
              onChange={(e) =>
                set("seeding", e.target.value as TemplateOptions["seeding"])
              }
            >
              <option value="serpentine">Serpentina</option>
              <option value="sequential">Secuencial</option>
              <option value="random">Sorteo por bombos</option>
            </select>
          </label>
        )}
        <div className="space-y-1 self-end">
          {template?.uses.includes("thirdPlace") &&
            check("Partido por 3er puesto", "thirdPlace")}
          {template?.uses.includes("grandFinalReset") &&
            check("Final de desempate", "grandFinalReset")}
          {template?.uses.includes("doubleRound") &&
            check("Ida y vuelta", "doubleRound")}
        </div>
      </div>

      <fieldset
        className="space-y-3 rounded-xl bg-navy-50/50 p-4"
        disabled={Boolean(customJson)}
      >
        <legend className="sr-only">Tipo de partido</legend>
        <p className="text-sm font-semibold text-navy-800">
          Tipo de partido
          {customJson && (
            <span className="ml-2 font-normal text-navy-400">
              (lo define la definición escrita a mano)
            </span>
          )}
        </p>
        {customStageRules && !modeTouched && !template && (
          <p className="text-xs text-amber-700">
            Este formato tiene reglas distintas por fase escritas a mano. Si
            cambias el tipo de partido aquí, se reemplazan por lo que elijas.
          </p>
        )}
        <MatchModeFields
          label={
            preview.format && preview.format.stages.length > 1 && finalMode
              ? "Fases anteriores"
              : "Todos los partidos"
          }
          value={mainMode}
          onChange={(m) => {
            setCustomJson(null);
            setModeTouched(true);
            setMainMode(m);
          }}
        />
        {(preview.format?.stages.length ?? 0) > 1 && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(finalMode)}
              onChange={(e) => {
                setModeTouched(true);
                setFinalMode(
                  e.target.checked ? { ...mainMode, setsToWin: 2 } : null,
                );
              }}
            />
            La última fase ({preview.format?.stages.at(-1)?.name}) se juega
            distinto
          </label>
        )}
        {finalMode && (preview.format?.stages.length ?? 0) > 1 && (
          <MatchModeFields
            label={`Última fase: ${preview.format?.stages.at(-1)?.name}`}
            value={finalMode}
            onChange={(m) => {
              setModeTouched(true);
              setFinalMode(m);
            }}
          />
        )}
      </fieldset>

      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Editar definición a mano (avanzado)
        </summary>
        <textarea
          className="mt-2 h-72 w-full rounded-lg border p-2 font-mono text-xs"
          value={
            customJson ??
            (preview.format ? JSON.stringify(preview.format, null, 2) : "")
          }
          onChange={(e) => setCustomJson(e.target.value)}
        />
        {customJson && (
          <button
            className="text-xs text-sky-700 underline"
            onClick={() => setCustomJson(null)}
          >
            Volver a la plantilla
          </button>
        )}
      </details>

      {preview.err && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-700"
        >
          No se puede generar: {preview.err}
        </p>
      )}
      {preview.problems.length > 0 && (
        <div
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <p className="font-semibold">
            Este formato no se puede jugar completo:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {preview.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {preview.gen && preview.state && preview.format && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-navy-500">
              {preview.gen.matches.length} partidos ·{" "}
              {preview.gen.groups.length} grupos ·{" "}
              {preview.format.stages.length} fases
            </span>
            <button
              className="btn-primary"
              disabled={pending || preview.problems.length > 0}
              onClick={save}
            >
              {pending
                ? "Guardando…"
                : existing
                  ? "Guardar cambios del formato"
                  : "Guardar y generar partidos"}
            </button>
            {saved && <span className="text-sm text-sky-700">✓ {saved}</span>}
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-700"
            >
              {error}
            </p>
          )}
          <div className="space-y-4">
            {preview.format.stages.map((s) => (
              <StageView
                key={s.key}
                stage={s}
                gen={preview.gen!}
                state={preview.state!}
                helpers={{
                  teamName,
                  describe: makeDescribe(preview.gen!, teamName),
                }}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function MatchModeFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MatchMode;
  onChange: (m: MatchMode) => void;
}) {
  const set = (k: keyof MatchMode, v: number) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <label className="block text-sm">
        <span className="mb-1 block text-navy-700">{label}</span>
        <select
          className="input"
          value={value.setsToWin}
          onChange={(e) => set("setsToWin", Number(e.target.value))}
        >
          <option value={1}>A 1 set</option>
          <option value={2}>Mejor de 3 sets (gana quien gane 2)</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-navy-700">
          {value.setsToWin === 1 ? "Puntos del set" : "Sets 1 y 2 a"}
        </span>
        <input
          type="number"
          min={5}
          max={50}
          className="input w-24"
          value={value.setPoints}
          onChange={(e) => set("setPoints", Number(e.target.value))}
        />
      </label>
      {value.setsToWin > 1 && (
        <label className="block text-sm">
          <span className="mb-1 block text-navy-700">Set decisivo a</span>
          <input
            type="number"
            min={5}
            max={50}
            className="input w-24"
            value={value.decidingSetPoints}
            onChange={(e) => set("decidingSetPoints", Number(e.target.value))}
          />
        </label>
      )}
      <p className="text-xs text-sky-700 sm:col-span-3">
        {describeMatchRules(value)}, con diferencia de 2 puntos.
      </p>
    </div>
  );
}
