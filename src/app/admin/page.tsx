import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import type { Tournament } from "@/lib/data";
import { createTournament } from "./actions";

export const metadata = { title: "Panel · Torneos Vóley Playa" };

export default async function AdminHome() {
  await requireAdmin();
  const tournaments = await sql<Tournament[]>`
    select * from tournaments order by start_date desc nulls first, created_at desc`;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <section className="card">
        <h1 className="text-xl font-bold">Torneos</h1>
        <ul className="mt-3 divide-y">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/torneos/${t.id}`} className="flex items-center justify-between py-2 hover:bg-gray-50">
                <span>
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    {[t.city, t.start_date].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${t.published ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
                >
                  {t.published ? "Publicado" : "Borrador"}
                </span>
              </Link>
            </li>
          ))}
          {tournaments.length === 0 && <li className="py-2 text-sm text-gray-500">Todavía no hay torneos.</li>}
        </ul>
      </section>

      <form action={createTournament} className="card space-y-3">
        <h2 className="font-semibold">Nuevo torneo</h2>
        <input name="name" required placeholder="Nombre" className="input" />
        <input name="city" placeholder="Ciudad / playa" className="input" />
        <div className="grid grid-cols-2 gap-2">
          <input name="start_date" type="date" className="input" aria-label="Inicio" />
          <input name="end_date" type="date" className="input" aria-label="Fin" />
        </div>
        <button className="btn-primary w-full">Crear torneo</button>
      </form>
    </div>
  );
}
