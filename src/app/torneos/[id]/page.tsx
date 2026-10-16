import Link from "next/link";
import { notFound } from "next/navigation";
import { GENDER_LABEL, isUuid, type Category, type Tournament } from "@/lib/data";
import { sql } from "@/lib/db";
import { PHASE_LABEL, formatRange, tournamentPhase } from "@/lib/format";
import { SiteFooter, SiteHeader } from "@/components/Brand";
import { PhaseBadge } from "@/components/PhaseBadge";

// En caché (CDN de Vercel): miles de visitas no tocan la base de datos. Cada cambio de un
// administrador invalida la caché al instante (revalidatePath en admin/actions.ts); los
// 5 minutos son solo un respaldo.
export const revalidate = 300;

// Ninguna página se genera al compilar: cada una se crea en su primera visita y queda en caché.
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

const STATUS = {
  setup: { label: "Por iniciar", phase: "upcoming" },
  in_progress: { label: "En juego", phase: "live" },
  finished: { label: "Terminado", phase: "past" },
} as const;

export default async function PublicTournament({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // Solo torneos publicados: un borrador responde 404 aunque se conozca el enlace.
  const [t] = await sql<Tournament[]>`select * from tournaments where id = ${id} and published`;
  if (!t) notFound();
  const categories = await sql<(Pick<Category, "id" | "name" | "gender" | "status"> & { teams: number })[]>`
    select c.id, c.name, c.gender, c.status, (select count(*)::int from teams where category_id = c.id) as teams
    from categories c where c.tournament_id = ${id} order by c.created_at`;
  const phase = tournamentPhase(t.start_date, t.end_date);
  const when = formatRange(t.start_date, t.end_date);

  return (
    <>
      <SiteHeader>
        <Link href="/" className="text-sm font-medium text-sky-200 transition-colors duration-150 hover:text-white">
          ← Torneos
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{t.name}</h1>
          {phase !== "unknown" && <PhaseBadge phase={phase}>{PHASE_LABEL[phase]}</PhaseBadge>}
        </div>
        <p className="mt-2 text-sky-100/80">{[t.city, when].filter(Boolean).join(" · ")}</p>
      </SiteHeader>

      <main className="mx-auto -mt-6 max-w-6xl px-4 sm:px-6">
        <h2 className="sr-only">Categorías</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c, i) => {
            const s = STATUS[c.status as keyof typeof STATUS];
            return (
              <li key={c.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
                <Link href={`/torneos/${t.id}/${c.id}`} className="card-link h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="eyebrow">{GENDER_LABEL[c.gender as "F"]}</p>
                      <p className="mt-1 text-xl font-semibold text-navy-900">{c.name}</p>
                    </div>
                    <PhaseBadge phase={s.phase}>{s.label}</PhaseBadge>
                  </div>
                  <p className="mt-4 text-sm text-navy-400">
                    {c.teams} {c.teams === 1 ? "dupla" : "duplas"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
        {categories.length === 0 && (
          <p className="card text-center text-navy-400">Las categorías se publicarán pronto.</p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
