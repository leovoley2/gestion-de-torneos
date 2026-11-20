"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addTeam,
  createAthleteRecord,
  deleteTeam,
  reorderTeams,
  replaceTeamPlayers,
  searchAthletes,
  type AthleteOption,
} from "@/app/admin/actions";
import type { Team } from "@/lib/data";
import { formatPoints } from "@/lib/ranking-calc";

export function TeamsManager({
  categoryId,
  teams,
  locked,
  hasFormat = false,
  results = 0,
  points,
}: {
  categoryId: string;
  teams: Team[];
  /** Sin permiso de edición: solo se muestra la lista. */
  locked: boolean;
  /** El formato ya está armado: se pueden corregir jugadores y siembra; agregar/quitar solo sin resultados. */
  hasFormat?: boolean;
  results?: number;
  /** Puntos de ranking de cada dupla (suma de sus dos jugadores), si la categoría suma a un ranking. */
  points?: Record<string, number>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Con resultados no cambia la cantidad de duplas (el formato depende de ella).
  const canAddRemove = !locked && results === 0;
  const [p1, setP1] = useState<AthleteOption | null>(null);
  const [p2, setP2] = useState<AthleteOption | null>(null);
  const [pickerKey, setPickerKey] = useState(0);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.error ?? "Error"));
      setNotice(r.ok ? (r.message ?? null) : null);
      if (r.ok) onOk?.();
    });
  const formatWarning = hasFormat ? "\n\nEl formato se borra y tendrás que volver a armarlo (todavía no hay resultados)." : "";

  const move = (i: number, dir: -1 | 1) => {
    const ids = teams.map((t) => t.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    run(() => reorderTeams(categoryId, ids));
  };

  // Siembra por ranking: más puntos primero; los empates conservan el orden actual.
  const byRanking = points
    ? [...teams].sort((a, b) => (points[b.id] ?? 0) - (points[a.id] ?? 0) || a.seed - b.seed).map((t) => t.id)
    : null;
  const alreadyByRanking = byRanking?.every((id, i) => teams[i]?.id === id) ?? true;

  const add = () => {
    if (!p1 || !p2) return setError("Elige a los dos jugadores");
    const fd = new FormData();
    fd.set("athlete1_id", p1.id);
    fd.set("athlete2_id", p2.id);
    if (hasFormat && !window.confirm(`¿Agregar la dupla?${formatWarning}`)) return;
    run(
      () => addTeam(categoryId, fd),
      () => {
        setP1(null);
        setP2(null);
        setPickerKey((k) => k + 1);
      },
    );
  };

  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-navy-900">Duplas</h2>
          <p className="text-sm text-navy-400">
            El orden es la siembra (1 = mejor).
            {!locked && hasFormat && results > 0 && " Puedes corregir jugadores o siembra si no cambia ningún partido ya jugado."}
          </p>
        </div>
        {!locked && byRanking && teams.length > 1 && (
          <button className="btn" disabled={pending || alreadyByRanking} onClick={() => run(() => reorderTeams(categoryId, byRanking))}>
            {alreadyByRanking ? "Ordenado por ranking ✓" : "Ordenar por ranking"}
          </button>
        )}
      </div>
      <ol className="divide-y divide-navy-50">
        {teams.map((t, i) => (
          <li key={t.id} className="py-2 text-sm">
            <div className="flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sky-100 text-[11px] font-bold text-navy-800 tabular-nums">
              {t.seed}
            </span>
            <span className="min-w-0 flex-1 truncate text-navy-900">
              {t.player1} / {t.player2}
            </span>
            {points && (
              <span className="shrink-0 text-xs font-semibold text-navy-500 tabular-nums" title="Puntos de ranking de la dupla">
                {formatPoints(points[t.id] ?? 0)} pts
              </span>
            )}
            {!locked && (
              <>
                <button
                  className="btn h-7 px-2 text-xs"
                  disabled={pending}
                  onClick={() => setEditing(editing === t.id ? null : t.id)}
                  aria-expanded={editing === t.id}
                  title="Cambiar jugadores (corrige un error sin perder resultados)"
                >
                  Editar
                </button>
                <button className="btn size-7 p-0" disabled={pending || i === 0} onClick={() => move(i, -1)} aria-label="Subir">
                  ↑
                </button>
                <button className="btn size-7 p-0" disabled={pending || i === teams.length - 1} onClick={() => move(i, 1)} aria-label="Bajar">
                  ↓
                </button>
                {canAddRemove && (
                  <button
                    className="btn-danger size-7 p-0"
                    disabled={pending}
                    onClick={() =>
                      window.confirm(`¿Quitar a ${t.player1} / ${t.player2}?${formatWarning}`) && run(() => deleteTeam(categoryId, t.id))
                    }
                    aria-label="Quitar"
                  >
                    ✕
                  </button>
                )}
              </>
            )}
            </div>
            {editing === t.id && (
              <ReplacePlayers
                categoryId={categoryId}
                team={t}
                pending={pending}
                onCancel={() => setEditing(null)}
                onSave={(a1, a2) => {
                  const fd = new FormData();
                  fd.set("athlete1_id", a1);
                  fd.set("athlete2_id", a2);
                  run(() => replaceTeamPlayers(categoryId, t.id, fd), () => setEditing(null));
                }}
              />
            )}
          </li>
        ))}
        {teams.length === 0 && <li className="py-2 text-sm text-navy-400">Todavía no hay duplas.</li>}
      </ol>
      {!locked && !canAddRemove && (
        <p className="mt-3 text-xs text-navy-400">
          Con resultados cargados no se pueden agregar ni quitar duplas. Para eso, reinicia el formato.
        </p>
      )}
      {canAddRemove && (
        <div className="mt-4 space-y-3 border-t border-navy-50 pt-4">
          <p className="text-sm font-medium text-navy-700">Agregar dupla a mano</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <AthletePicker key={`a${pickerKey}`} categoryId={categoryId} label="Jugador 1" value={p1} onChange={setP1} />
            <AthletePicker key={`b${pickerKey}`} categoryId={categoryId} label="Jugador 2" value={p2} onChange={setP2} />
          </div>
          <button className="btn-primary" disabled={pending || !p1 || !p2} onClick={add}>
            Agregar dupla
          </button>
        </div>
      )}
      {notice && (
        <p role="status" className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm whitespace-pre-line text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}

/** Cambiar uno o los dos jugadores de una dupla: conserva la dupla, su siembra y sus resultados. */
function ReplacePlayers({
  categoryId,
  team,
  pending,
  onCancel,
  onSave,
}: {
  categoryId: string;
  team: Team;
  pending: boolean;
  onCancel: () => void;
  onSave: (athlete1: string, athlete2: string) => void;
}) {
  const current = (id: string | null, name: string): AthleteOption | null =>
    id ? { id, name, document: "actual", gender: null, birthdate: null, hasAccount: true } : null;
  const [a1, setA1] = useState<AthleteOption | null>(current(team.athlete1_id, team.player1));
  const [a2, setA2] = useState<AthleteOption | null>(current(team.athlete2_id, team.player2));
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-navy-50/50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <AthletePicker categoryId={categoryId} label="Jugador 1" value={a1} onChange={setA1} />
        <AthletePicker categoryId={categoryId} label="Jugador 2" value={a2} onChange={setA2} />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary px-3 py-1.5 text-xs" disabled={pending || !a1 || !a2} onClick={() => a1 && a2 && onSave(a1.id, a2.id)}>
          Guardar jugadores
        </button>
        <button className="btn px-3 py-1.5 text-xs" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Busca un atleta por nombre o documento, o crea su ficha si todavía no existe. */
function AthletePicker({
  categoryId,
  label,
  value,
  onChange,
}: {
  categoryId: string;
  label: string;
  value: AthleteOption | null;
  onChange: (a: AthleteOption | null) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AthleteOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (value || q.trim().length < 2) return;
    const timer = setTimeout(() => {
      searchAthletes(categoryId, q).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, value, categoryId]);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50/50 px-3 py-2 text-sm">
        <span>
          <span className="block text-[11px] text-navy-400">{label}</span>
          <span className="font-semibold text-navy-900">{value.name}</span>
          <span className="text-xs text-navy-400">
            {" "}
            · {value.document ?? "sin documento"}
            {!value.hasAccount && " · ficha sin cuenta"}
          </span>
        </span>
        <button className="btn px-2 py-1 text-xs" onClick={() => onChange(null)}>
          Cambiar
        </button>
      </div>
    );
  }

  if (creating) {
    return (
      <form
        className="space-y-2 rounded-lg border border-navy-100 p-3"
        action={(fd) =>
          start(async () => {
            const r = await createAthleteRecord(categoryId, fd);
            if (r.ok && r.athlete) onChange(r.athlete);
            else setError(r.ok ? null : r.error);
          })
        }
      >
        <p className="text-xs font-semibold text-navy-700">Nueva ficha · {label}</p>
        <div className="grid grid-cols-2 gap-2">
          <input name="first_name" required placeholder="Nombres" defaultValue={q} className="input" />
          <input name="last_name" required placeholder="Apellidos" className="input" />
          <input name="document_number" required placeholder="Documento" className="input uppercase" />
          <select name="gender" required defaultValue="" className="input">
            <option value="" disabled>
              Sexo…
            </option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
          </select>
          <label className="col-span-2 block text-xs text-navy-500">
            Fecha de nacimiento
            <input name="birthdate" type="date" className="input mt-1" />
          </label>
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex gap-2">
          <button className="btn-primary px-3 py-1.5 text-xs" disabled={pending}>
            Crear ficha
          </button>
          <button type="button" className="btn px-3 py-1.5 text-xs" onClick={() => setCreating(false)}>
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`${label}: nombre o documento`}
        aria-label={label}
        className="input"
      />
      {q.trim().length >= 2 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-navy-100 bg-white text-sm shadow-[0_12px_32px_-12px_rgb(12_31_63/0.35)]">
          {results.map((a) => (
            <li key={a.id}>
              <button type="button" className="w-full px-3 py-2 text-left hover:bg-sky-50" onClick={() => onChange(a)}>
                <span className="font-medium text-navy-900">{a.name}</span>
                <span className="text-xs text-navy-400">
                  {" "}
                  · {a.document ?? "sin documento"} · {a.gender === "F" ? "F" : a.gender === "M" ? "M" : "—"}
                  {!a.hasAccount && " · ficha"}
                </span>
              </button>
            </li>
          ))}
          <li className="border-t border-navy-50">
            <button type="button" className="w-full px-3 py-2 text-left font-semibold text-sky-700 hover:bg-sky-50" onClick={() => setCreating(true)}>
              + Crear ficha nueva
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
