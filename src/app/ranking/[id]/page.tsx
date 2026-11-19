import Link from "next/link";
import { notFound } from "next/navigation";
import { GENDER_LABEL, isUuid } from "@/lib/data";
import { computeRanking } from "@/lib/ranking";
import { sql } from "@/lib/db";
import { SiteFooter, SiteHeader } from "@/components/Brand";

export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

const pts = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return {};
  const [r] = await sql<{ name: string; season: number }[]>`select name, season from rankings where id = ${id} and published`;
  return r ? { title: `${r.name} ${r.season} · Vóley Playa` } : {};
}

export default async function RankingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const view = await computeRanking(id);
  if (!view || !view.ranking.published) notFound();
  const { ranking, rows, categories } = view;

  return (
    <>
      <SiteHeader>
        <Link href="/ranking" className="text-sm font-medium text-sky-200 transition-colors duration-150 hover:text-white">
          ← Rankings
        </Link>
        <p className="eyebrow mt-4 text-sky-300">
          {GENDER_LABEL[ranking.gender]} · Temporada {ranking.season}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{ranking.name}</h1>
        <p className="mt-2 text-sky-100/80">
          {categories.length} {categories.length === 1 ? "torneo jugado" : "torneos jugados"} · {rows.length} jugadores
        </p>
      </SiteHeader>
      <main className="mx-auto -mt-6 max-w-4xl px-4 sm:px-6">
        <ol className="overflow-hidden rounded-2xl border border-navy-100/70 bg-white shadow-[0_1px_2px_rgb(12_31_63/0.04),0_8px_24px_-12px_rgb(12_31_63/0.12)]">
          {rows.map((r) => (
            <li key={r.athleteId} className="border-b border-navy-50 last:border-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3 hover:bg-sky-50/40 sm:px-5">
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums ${r.rank <= 3 ? "bg-sky-400 text-navy-950" : "bg-navy-50 text-navy-600"}`}
                  >
                    {r.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-navy-900">{r.name}</span>
                    <span className="block truncate text-xs text-navy-400">
                      {[r.club, r.city].filter(Boolean).join(" · ") || " "}
                    </span>
                  </span>
                  <span className="hidden text-right text-xs text-navy-400 sm:block">
                    {r.events} {r.events === 1 ? "torneo" : "torneos"}
                    <br />
                    mejor: {r.best}º
                  </span>
                  <span className="w-16 text-right text-lg font-bold text-navy-900 tabular-nums">{pts(r.points)}</span>
                </summary>
                <ul className="space-y-1 bg-navy-50/40 px-4 py-3 text-sm sm:px-5 sm:pl-[4.25rem]">
                  {r.awards.map((a) => (
                    <li key={a.categoryId} className="flex justify-between gap-3">
                      <span className="text-navy-600">
                        {a.label} · <strong>{a.position}º</strong>
                      </span>
                      <span className="font-semibold text-navy-800 tabular-nums">+{pts(a.points)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          ))}
          {rows.length === 0 && <li className="px-5 py-6 text-center text-navy-400">Todavía no hay resultados en este ranking.</li>}
        </ol>
        <p className="mt-3 text-xs text-navy-400">
          Toca un jugador para ver de dónde vienen sus puntos. Los puntos de una dupla son la suma de los de sus dos jugadores.
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
