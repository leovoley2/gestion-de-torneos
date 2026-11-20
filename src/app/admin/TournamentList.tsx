"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TournamentSummary } from "@/lib/admin-dashboard";
import { TournamentCard } from "./TournamentCard";

type Filter = "all" | "live" | "upcoming" | "past" | "draft";
const FILTERS: [Filter, string][] = [
  ["all", "Todos"],
  ["live", "En curso"],
  ["upcoming", "Próximos"],
  ["past", "Terminados"],
  ["draft", "Borradores"],
];

const matches = (t: TournamentSummary, f: Filter) =>
  f === "all"
    ? true
    : f === "draft"
      ? !t.published
      : f === "upcoming"
        ? t.phase === "upcoming" || t.phase === "unknown"
        : t.phase === f;

/** Lista de torneos con filtros por estado, búsqueda y avance de resultados. */
export function TournamentList({
  tournaments,
  archived = 0,
}: {
  tournaments: TournamentSummary[];
  /** Torneos más antiguos que quedaron en el archivo. */
  archived?: number;
}) {
  // Por defecto se muestran los que están en juego si hay alguno.
  const [filter, setFilter] = useState<Filter>(
    tournaments.some((t) => t.phase === "live") ? "live" : "all",
  );
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tournaments.filter(
      (t) =>
        matches(t, filter) &&
        (!needle || `${t.name} ${t.city ?? ""}`.toLowerCase().includes(needle)),
    );
  }, [tournaments, filter, q]);

  return (
    <section aria-label="Torneos" className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="flex gap-1 overflow-x-auto rounded-xl bg-navy-50/70 p-1"
          role="tablist"
          aria-label="Filtrar torneos"
        >
          {FILTERS.map(([f, label]) => {
            const n = tournaments.filter((t) => matches(t, f)).length;
            return (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                  filter === f
                    ? "bg-white text-navy-900 shadow-sm"
                    : "text-navy-500 hover:text-navy-800"
                }`}
              >
                {label}{" "}
                <span className="font-normal text-navy-400 tabular-nums">
                  {n}
                </span>
              </button>
            );
          })}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar torneo o ciudad"
          aria-label="Buscar torneo"
          className="input ml-auto w-full py-1.5 text-sm sm:w-56"
        />
      </div>

      <ul className="space-y-3">
        {shown.map((t) => {
          return (
            <li key={t.id}>
              <TournamentCard t={t} />
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && (
        <div className="card text-center">
          <p className="font-semibold text-navy-800">
            {tournaments.length === 0
              ? "Todavía no hay torneos"
              : "Ningún torneo con ese filtro"}
          </p>
          {tournaments.length > 0 && (
            <button
              className="btn mt-3"
              onClick={() => (setFilter("all"), setQ(""))}
            >
              Ver todos
            </button>
          )}
        </div>
      )}
      {archived > 0 && (
        <p className="pt-1 text-center text-sm text-navy-400">
          Los torneos terminados hace más de 3 meses están en el{" "}
          <Link
            href="/admin/archivo"
            className="font-semibold text-sky-700 underline-offset-2 hover:underline"
          >
            archivo ({archived})
          </Link>
        </p>
      )}
    </section>
  );
}
