"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCategoryRanking, setFinalPosition } from "@/app/admin/ranking-actions";

type Option = { id: string; label: string };

export function CategoryRankingForm({
  categoryId,
  rankingId,
  tableId,
  rankings,
  tables,
}: {
  categoryId: string;
  rankingId: string | null;
  tableId: string | null;
  rankings: Option[];
  tables: Option[];
}) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="grid gap-2 rounded-xl bg-navy-50/50 p-3 sm:grid-cols-[1fr_1fr_auto]"
      action={(fd) =>
        start(async () => {
          const r = await setCategoryRanking(categoryId, fd);
          setMsg(r.ok ? { ok: true, text: r.message ?? "Guardado" } : { ok: false, text: r.error });
          if (r.ok) router.refresh();
        })
      }
    >
      <select name="ranking_id" defaultValue={rankingId ?? ""} className="input" aria-label="Ranking">
        <option value="">No suma a ningún ranking</option>
        {rankings.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
      <select name="point_table_id" defaultValue={tableId ?? ""} className="input" aria-label="Tabla de puntos">
        <option value="">Tabla de puntos…</option>
        {tables.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <button className="btn-primary" disabled={pending}>
        Guardar
      </button>
      {msg && (
        <p className={`text-sm sm:col-span-3 ${msg.ok ? "text-sky-700" : "text-red-700"}`} role={msg.ok ? "status" : "alert"}>
          {msg.text}
        </p>
      )}
      {rankings.length === 0 && (
        <p className="text-xs text-navy-400 sm:col-span-3">No hay rankings de esta rama: créalos en el menú Ranking.</p>
      )}
    </form>
  );
}

/** Puesto final editable: al cambiarlo se guarda como corrección; vacío vuelve al calculado. */
export function PositionInput({
  categoryId,
  teamId,
  position,
  computed,
  overridden,
}: {
  categoryId: string;
  teamId: string;
  position: number;
  computed: number;
  overridden: boolean;
}) {
  const [value, setValue] = useState(String(position));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  // Se lee el valor del propio campo al salir (no del estado), para no usar un valor desactualizado.
  const commit = (raw: string) => {
    const v = raw.trim();
    const next = v === "" || Number(v) === computed ? null : Number(v);
    if ((next ?? computed) === position && (next === null) === !overridden) return;
    start(async () => {
      const r = await setFinalPosition(categoryId, teamId, next);
      setError(r.ok ? null : r.error);
      if (r.ok) router.refresh();
    });
  };
  return (
    <span className="inline-flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        onBlur={(e) => commit(e.currentTarget.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        disabled={pending}
        inputMode="numeric"
        className={`input w-14 px-2 py-1 text-center tabular-nums ${overridden ? "border-amber-300 bg-amber-50" : ""}`}
        aria-label="Puesto final"
        title={overridden ? `Corregido a mano (calculado: ${computed}º). Vacía el campo para volver al calculado.` : "Calculado"}
      />
      {overridden && <span className="text-xs text-amber-700" aria-hidden="true">✎</span>}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
