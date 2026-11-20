"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { TournamentSummary } from "@/lib/admin-dashboard";
import { PHASE_LABEL, formatRange } from "@/lib/format";
import { PhaseBadge } from "@/components/PhaseBadge";
import { PublishedBadge } from "@/components/AdminUI";

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
}: {
  tournaments: TournamentSummary[];
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
          const pct =
            t.matches > 0
              ? Math.round((Math.min(t.results, t.matches) / t.matches) * 100)
              : 0;
          return (
            <li key={t.id}>
              <Link
                href={`/admin/torneos/${t.id}`}
                className="card-link block py-4"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-navy-900">
                      {t.name}
                    </span>
                    <span className="mt-0.5 block text-sm text-navy-400">
                      {[t.city, formatRange(t.start_date, t.end_date)]
                        .filter(Boolean)
                        .join(" · ") || "Sin fechas"}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {t.phase !== "unknown" && (
                      <PhaseBadge phase={t.phase}>
                        {PHASE_LABEL[t.phase]}
                      </PhaseBadge>
                    )}
                    <PublishedBadge published={t.published} />
                  </span>
                </span>
                <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-500">
                  <span>
                    <strong className="text-navy-800 tabular-nums">
                      {t.categories}
                    </strong>{" "}
                    {t.categories === 1 ? "categoría" : "categorías"}
                  </span>
                  <span>
                    <strong className="text-navy-800 tabular-nums">
                      {t.teams}
                    </strong>{" "}
                    duplas
                  </span>
                  {t.matches > 0 && (
                    <span>
                      <strong className="text-navy-800 tabular-nums">
                        {Math.min(t.results, t.matches)}/{t.matches}
                      </strong>{" "}
                      partidos
                    </span>
                  )}
                  {t.pending_reviews > 0 && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ring-1 ring-amber-200 ring-inset">
                      {t.pending_reviews} por revisar
                    </span>
                  )}
                </span>
                {t.matches > 0 && (
                  <span
                    className="mt-2 block h-1.5 overflow-hidden rounded-full bg-navy-50"
                    aria-hidden="true"
                  >
                    <span
                      className="block h-full rounded-full bg-sky-500"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                )}
              </Link>
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
    </section>
  );
}
