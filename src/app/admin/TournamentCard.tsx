import Link from "next/link";
import type { TournamentSummary } from "@/lib/admin-dashboard";
import { PHASE_LABEL, formatRange } from "@/lib/format";
import { PhaseBadge } from "@/components/PhaseBadge";
import { PublishedBadge } from "@/components/AdminUI";

/** Tarjeta de un torneo en el panel: fechas, estado, conteos y avance de resultados. */
export function TournamentCard({ t }: { t: TournamentSummary }) {
  const played = Math.min(t.results, t.matches);
  const pct = t.matches > 0 ? Math.round((played / t.matches) * 100) : 0;
  return (
    <Link href={`/admin/torneos/${t.id}`} className="card-link block py-4">
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate font-semibold text-navy-900">{t.name}</span>
          <span className="mt-0.5 block text-sm text-navy-400">
            {[t.city, formatRange(t.start_date, t.end_date)].filter(Boolean).join(" · ") || "Sin fechas"}
          </span>
        </span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {t.phase !== "unknown" && <PhaseBadge phase={t.phase}>{PHASE_LABEL[t.phase]}</PhaseBadge>}
          <PublishedBadge published={t.published} />
        </span>
      </span>
      <span className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-500">
        <span>
          <strong className="text-navy-800 tabular-nums">{t.categories}</strong>{" "}
          {t.categories === 1 ? "categoría" : "categorías"}
        </span>
        <span>
          <strong className="text-navy-800 tabular-nums">{t.teams}</strong> duplas
        </span>
        {t.matches > 0 && (
          <span>
            <strong className="text-navy-800 tabular-nums">
              {played}/{t.matches}
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
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-navy-50" aria-hidden="true">
          <span className="block h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
        </span>
      )}
    </Link>
  );
}
