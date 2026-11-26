import Link from "next/link";
import { REGISTRATION_STATUS, closesInLabel } from "@/lib/athletes";
import { GENDER_LABEL } from "@/lib/data";
import { formatRange } from "@/lib/format";
import { feeOf, formatSoles, type RegCategory } from "@/lib/registrations";
import type { OpenStop, StopCategory } from "@/lib/open-stops";

/** Paradas con inscripción abierta: una tarjeta por torneo con sus categorías y qué puede hacer el atleta. */
export function OpenStops({ stops }: { stops: OpenStop<RegCategory>[] }) {
  if (stops.length === 0) {
    return (
      <div className="card flex items-center gap-4 text-sm text-navy-500">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-400">
          <CalendarIcon />
        </span>
        No hay paradas con inscripciones abiertas por ahora. Cuando la organización abra una, aparecerá aquí.
      </div>
    );
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {stops.map((s, i) => (
        <li key={s.tournamentId} className="rise" style={{ "--i": i } as React.CSSProperties}>
          <StopCard stop={s} />
        </li>
      ))}
    </ul>
  );
}

function StopCard({ stop }: { stop: OpenStop<RegCategory> }) {
  const closes = closesInLabel(stop.closesAt);
  const urgent = closes === "Cierra hoy" || closes === "Cierra mañana";
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgb(12_31_63/0.05),0_10px_28px_-16px_rgb(12_31_63/0.25)] ring-1 ring-navy-100/70">
      <header className="bg-ocean relative px-5 pt-4 pb-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg leading-snug font-semibold text-balance">{stop.name}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sky-100/85">
              {stop.city && (
                <span className="flex items-center gap-1">
                  <PinIcon /> {stop.city}
                </span>
              )}
              {formatRange(stop.startDate, stop.endDate) && (
                <span className="flex items-center gap-1">
                  <CalendarIcon className="size-3.5" /> {formatRange(stop.startDate, stop.endDate)}
                </span>
              )}
            </p>
          </div>
          {closes && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${urgent ? "bg-amber-300 text-amber-950 ring-amber-200" : "bg-white/10 text-sky-50 ring-white/20"}`}
            >
              {closes}
            </span>
          )}
        </div>
      </header>
      <ul className="flex-1 divide-y divide-navy-50">
        {stop.categories.map((c) => (
          <CategoryRow key={c.category.id} item={c} />
        ))}
      </ul>
    </article>
  );
}

function CategoryRow({ item }: { item: StopCategory<RegCategory> }) {
  const { category: c, state, spotsLeft } = item;
  const fee = feeOf(c);
  const muted = state.kind === "not_for_you" || state.kind === "full";
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5 ${muted ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1 basis-44">
        <p className="font-semibold text-navy-900">
          {c.name} <span className="text-sm font-normal text-navy-400">· {GENDER_LABEL[c.gender]}</span>
        </p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-navy-500">
          <span>{fee !== null ? `${formatSoles(fee)} por dupla` : "Sin costo"}</span>
          {spotsLeft !== null && (
            <span className={spotsLeft <= 3 && spotsLeft > 0 ? "font-semibold text-amber-700" : ""}>
              {spotsLeft === 0 ? "Sin cupos" : `${spotsLeft} ${spotsLeft === 1 ? "cupo libre" : "cupos libres"}`}
            </span>
          )}
          {state.kind === "not_for_you" && <span>{state.reason}</span>}
        </p>
      </div>
      {state.kind === "open" && (
        <Link href={`/cuenta/inscribirme?categoria=${c.id}`} className="btn-primary shrink-0 px-3.5 py-1.5 text-xs">
          Inscribirme
        </Link>
      )}
      {state.kind === "registered" && (
        <Link
          href={`/cuenta/inscripciones/${state.registrationId}`}
          className="shrink-0 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200 ring-inset hover:bg-sky-100"
        >
          {REGISTRATION_STATUS[state.status].label} →
        </Link>
      )}
      {state.kind === "full" && <span className="shrink-0 text-xs font-semibold text-navy-400">Completa</span>}
    </li>
  );
}

export function CalendarIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M8 14.2s4.6-4.2 4.6-7.8a4.6 4.6 0 1 0-9.2 0c0 3.6 4.6 7.8 4.6 7.8Z" strokeLinejoin="round" />
      <circle cx="8" cy="6.4" r="1.6" />
    </svg>
  );
}
