import Link from "next/link";
import { GENDER_LABEL } from "@/lib/data";
import { getRankings } from "@/lib/ranking";
import { SiteFooter, SiteHeader } from "@/components/Brand";

// En caché; se invalida cuando la organización cambia resultados, posiciones o rankings.
export const revalidate = 300;

export const metadata = { title: "Ranking · Vóley Playa" };

export default async function RankingsPage() {
  const rankings = await getRankings(true);
  const seasons = [...new Set(rankings.map((r) => r.season))];
  return (
    <>
      <SiteHeader>
        <p className="eyebrow text-sky-300">Circuito nacional</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">Ranking</h1>
        <p className="mt-3 max-w-xl text-sky-100/80">
          Cada torneo reparte puntos por puesto final; los puntos de la dupla se dividen por la mitad entre sus dos
          jugadores.
        </p>
      </SiteHeader>
      <main className="mx-auto -mt-6 max-w-6xl space-y-8 px-4 sm:px-6">
        {seasons.map((season) => (
          <section key={season}>
            <h2 className="mb-3 text-sm font-semibold text-navy-700">Temporada {season}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rankings
                .filter((r) => r.season === season)
                .map((r, i) => (
                  <li key={r.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
                    <Link href={`/ranking/${r.id}`} className="card-link">
                      <p className="eyebrow">{GENDER_LABEL[r.gender]}</p>
                      <p className="mt-1 text-lg font-semibold text-navy-900">{r.name}</p>
                      <span className="mt-4 inline-flex text-sm font-semibold text-sky-600">Ver ranking →</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
        {rankings.length === 0 && <p className="card text-center text-navy-400">El ranking se publicará pronto.</p>}
      </main>
      <SiteFooter />
    </>
  );
}
