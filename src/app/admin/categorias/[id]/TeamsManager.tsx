"use client";

import { useRef, useState, useTransition } from "react";
import { addTeam, deleteTeam, reorderTeams } from "@/app/admin/actions";
import type { Team } from "@/lib/data";

export function TeamsManager({ categoryId, teams, locked }: { categoryId: string; teams: Team[]; locked: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.error ?? "Error"));
      if (r.ok) onOk?.();
    });

  const move = (i: number, dir: -1 | 1) => {
    const ids = teams.map((t) => t.id);
    [ids[i], ids[i + dir]] = [ids[i + dir], ids[i]];
    run(() => reorderTeams(categoryId, ids));
  };

  return (
    <section className="card">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-navy-900">Duplas</h2>
        <span className="text-xs font-medium text-navy-400 tabular-nums">{teams.length} inscritas</span>
      </div>
      <p className="-mt-3 mb-3 text-sm text-navy-400">
        El orden es la siembra (1 = mejor ranking).{" "}
        {locked && "Para cambiarla hay que reiniciar el formato."}
      </p>
      <ol className="divide-y divide-navy-50">
        {teams.map((t, i) => (
          <li key={t.id} className="flex items-center gap-2 py-2 text-sm">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-sky-100 text-[11px] font-bold text-navy-800 tabular-nums">
              {t.seed}
            </span>
            <span className="min-w-0 flex-1 truncate text-navy-900">
              {t.player1} / {t.player2}
            </span>
            {!locked && (
              <>
                <button className="btn size-7 p-0" disabled={pending || i === 0} onClick={() => move(i, -1)} aria-label="Subir">
                  ↑
                </button>
                <button className="btn size-7 p-0" disabled={pending || i === teams.length - 1} onClick={() => move(i, 1)} aria-label="Bajar">
                  ↓
                </button>
                <button
                  className="btn-danger size-7 p-0"
                  disabled={pending}
                  onClick={() => window.confirm(`¿Quitar a ${t.player1} / ${t.player2}?`) && run(() => deleteTeam(categoryId, t.id))}
                  aria-label="Quitar"
                >
                  ✕
                </button>
              </>
            )}
          </li>
        ))}
      </ol>
      {!locked && (
        <form
          ref={formRef}
          className="mt-4 flex flex-wrap gap-2 border-t border-navy-50 pt-4"
          action={(fd) => run(() => addTeam(categoryId, fd), () => formRef.current?.reset())}
        >
          <input name="player1" required placeholder="Jugador 1" aria-label="Jugador 1" className="input min-w-36 flex-1" />
          <input name="player2" required placeholder="Jugador 2" aria-label="Jugador 2" className="input min-w-36 flex-1" />
          <button className="btn-primary" disabled={pending}>
            Agregar dupla
          </button>
        </form>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
