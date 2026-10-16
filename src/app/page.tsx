import Link from "next/link";
import { sql } from "@/lib/db";
import type { Tournament } from "@/lib/data";
import { PHASE_LABEL, formatRange, tournamentPhase } from "@/lib/format";
import { SiteFooter, SiteHeader } from "@/components/Brand";
import { PhaseBadge } from "@/components/PhaseBadge";

// En caché (CDN de Vercel): miles de visitas no tocan la base de datos. Cada cambio de un
// administrador invalida la caché al instante (revalidatePath en admin/actions.ts); los
// 5 minutos son solo un respaldo.
export const revalidate = 300;

export default async function Home() {
  const tournaments = await sql<Tournament[]>`
    select * from tournaments where published order by start_date desc nulls last, created_at desc`;

  return (
    <>
      <SiteHeader>
        <p className="eyebrow text-sky-300">Circuito de vóley playa</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-5xl">
          Resultados, llaves y posiciones <span className="text-sky-300">en vivo</span>
        </h1>
        <p className="mt-3 max-w-xl text-sky-100/80">
          Sigue cada partido de tu dupla: programación por cancha, grupos y eliminatorias actualizados al instante.
        </p>
      </SiteHeader>

      <main className="mx-auto -mt-6 max-w-6xl px-4 sm:px-6">
        <h2 className="sr-only">Torneos</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t, i) => {
            const phase = tournamentPhase(t.start_date, t.end_date);
            return (
              <li key={t.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
                <Link href={`/torneos/${t.id}`} className="card-link h-full">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-lg leading-snug font-semibold text-navy-900">{t.name}</span>
                    {phase !== "unknown" && <PhaseBadge phase={phase}>{PHASE_LABEL[phase]}</PhaseBadge>}
                  </div>
                  <dl className="mt-4 space-y-1 text-sm text-navy-400">
                    {t.city && (
                      <div className="flex items-center gap-2">
                        <dt className="sr-only">Lugar</dt>
                        <PinIcon />
                        <dd>{t.city}</dd>
                      </div>
                    )}
                    {formatRange(t.start_date, t.end_date) && (
                      <div className="flex items-center gap-2">
                        <dt className="sr-only">Fechas</dt>
                        <CalendarIcon />
                        <dd>{formatRange(t.start_date, t.end_date)}</dd>
                      </div>
                    )}
                  </dl>
                  <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-sky-600">
                    Ver torneo <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {tournaments.length === 0 && (
          <div className="card text-center">
            <p className="font-semibold text-navy-800">Todavía no hay torneos publicados</p>
            <p className="mt-1 text-sm text-navy-400">Vuelve pronto: aquí aparecerán la programación y los resultados.</p>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-sky-500" fill="currentColor" aria-hidden="true">
      <path d="M10 2a6 6 0 0 0-6 6c0 4.4 6 10 6 10s6-5.6 6-10a6 6 0 0 0-6-6Zm0 8.2A2.2 2.2 0 1 1 10 5.8a2.2 2.2 0 0 1 0 4.4Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-sky-500" fill="currentColor" aria-hidden="true">
      <path d="M6 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V3a1 1 0 0 1 1-1Zm10 7H4v7h12V9Z" />
    </svg>
  );
}
