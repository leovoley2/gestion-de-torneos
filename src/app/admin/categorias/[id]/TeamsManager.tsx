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
      <h2 className="font-semibold">Duplas ({teams.length})</h2>
      <p className="text-sm text-gray-500">
        El orden es la siembra (1 = mejor ranking).{" "}
        {locked && "Para cambiar duplas o siembra hay que reiniciar el formato."}
      </p>
      <ol className="mt-3 divide-y">
        {teams.map((t, i) => (
          <li key={t.id} className="flex items-center gap-2 py-1.5 text-sm">
            <span className="w-6 text-right font-mono text-gray-500">{t.seed}</span>
            <span className="flex-1">
              {t.player1} / {t.player2}
            </span>
            {!locked && (
              <>
                <button className="btn px-2 py-0.5" disabled={pending || i === 0} onClick={() => move(i, -1)} aria-label="Subir">
                  ↑
                </button>
                <button className="btn px-2 py-0.5" disabled={pending || i === teams.length - 1} onClick={() => move(i, 1)} aria-label="Bajar">
                  ↓
                </button>
                <button
                  className="btn-danger px-2 py-0.5"
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
          className="mt-3 flex flex-wrap gap-2"
          action={(fd) => run(() => addTeam(categoryId, fd), () => formRef.current?.reset())}
        >
          <input name="player1" required placeholder="Jugador 1" className="input max-w-[200px]" />
          <input name="player2" required placeholder="Jugador 2" className="input max-w-[200px]" />
          <button className="btn-primary" disabled={pending}>
            Agregar dupla
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
