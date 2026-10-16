import Link from "next/link";
import { sql } from "@/lib/db";
import type { Tournament } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const tournaments = await sql<Tournament[]>`
    select * from tournaments where published order by start_date desc nulls last, created_at desc`;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Torneos de Vóley Playa</h1>
          <p className="mt-1 text-gray-600">Programación, resultados y posiciones en vivo.</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-500 hover:underline">
          Administradores
        </Link>
      </div>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {tournaments.map((t) => (
          <li key={t.id}>
            <Link href={`/torneos/${t.id}`} className="card block hover:shadow-md">
              <span className="block text-lg font-semibold">{t.name}</span>
              <span className="text-sm text-gray-500">
                {[t.city, [t.start_date, t.end_date].filter(Boolean).join(" al ")].filter(Boolean).join(" · ")}
              </span>
            </Link>
          </li>
        ))}
        {tournaments.length === 0 && <li className="text-gray-500">Todavía no hay torneos publicados.</li>}
      </ul>
    </main>
  );
}
