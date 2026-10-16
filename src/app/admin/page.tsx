import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { Tournament } from "@/lib/data";
import { formatRange } from "@/lib/format";
import { PageTitle, PublishedBadge } from "@/components/AdminUI";
import { createTournament } from "./actions";

export const metadata = { title: "Panel · Torneos Vóley Playa" };

export default async function AdminHome() {
  await requireAdmin();
  const tournaments = await sql<(Tournament & { categories: number; results: number })[]>`
    select t.*,
      (select count(*)::int from categories where tournament_id = t.id) as categories,
      (select count(*)::int from results r join categories c on c.id = r.category_id where c.tournament_id = t.id) as results
    from tournaments t order by start_date desc nulls first, created_at desc`;
  const published = tournaments.filter((t) => t.published).length;
  const results = tournaments.reduce((n, t) => n + t.results, 0);

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Panel de administración" title="Torneos" />

      <dl className="grid grid-cols-3 gap-3 sm:max-w-xl">
        {[
          ["Torneos", tournaments.length],
          ["Publicados", published],
          ["Resultados cargados", results],
        ].map(([label, value], i) => (
          <div key={label} className="card rise px-4 py-3" style={{ "--i": i } as React.CSSProperties}>
            <dt className="text-[11px] font-medium text-navy-400">{label}</dt>
            <dd className="mt-0.5 text-2xl font-bold text-navy-900 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <section aria-label="Lista de torneos">
          <ul className="space-y-3">
            {tournaments.map((t, i) => (
              <li key={t.id} className="rise" style={{ "--i": i + 3 } as React.CSSProperties}>
                <Link href={`/admin/torneos/${t.id}`} className="card-link flex items-center justify-between gap-4 py-4">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-navy-900">{t.name}</span>
                    <span className="mt-0.5 block text-sm text-navy-400">
                      {[t.city, formatRange(t.start_date, t.end_date), `${t.categories} ${t.categories === 1 ? "categoría" : "categorías"}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <PublishedBadge published={t.published} />
                </Link>
              </li>
            ))}
          </ul>
          {tournaments.length === 0 && (
            <div className="card text-center">
              <p className="font-semibold text-navy-800">Todavía no hay torneos</p>
              <p className="mt-1 text-sm text-navy-400">Crea el primero con el formulario.</p>
            </div>
          )}
        </section>

        <form action={createTournament} className="card space-y-4 lg:sticky lg:top-24">
          <h2 className="font-semibold text-navy-900">Nuevo torneo</h2>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-navy-700">Nombre</span>
            <input name="name" required placeholder="Ej. Circuito Nacional – Etapa Máncora" className="input" />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-navy-700">Ciudad o playa</span>
            <input name="city" placeholder="Ej. Máncora" className="input" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-navy-700">Inicio</span>
              <input name="start_date" type="date" className="input" />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-navy-700">Fin</span>
              <input name="end_date" type="date" className="input" />
            </label>
          </div>
          <button className="btn-primary w-full py-2.5">Crear torneo</button>
          <p className="text-xs text-navy-400">Se crea como borrador: nadie lo ve hasta que lo publiques.</p>
        </form>
      </div>
    </div>
  );
}
