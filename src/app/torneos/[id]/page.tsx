import Link from "next/link";
import { notFound } from "next/navigation";
import { GENDER_LABEL, isUuid, type Category, type Tournament } from "@/lib/data";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUS = { setup: "Por iniciar", in_progress: "En juego", finished: "Terminado" } as const;

export default async function PublicTournament({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  // Solo torneos publicados: un borrador responde 404 aunque se conozca el enlace.
  const [t] = await sql<Tournament[]>`select * from tournaments where id = ${id} and published`;
  if (!t) notFound();
  const categories = await sql<Pick<Category, "id" | "name" | "gender" | "status">[]>`
    select id, name, gender, status from categories where tournament_id = ${id} order by created_at`;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/" className="text-sm text-sky-700 hover:underline">
        ← Torneos
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{t.name}</h1>
      <p className="text-gray-600">{[t.city, [t.start_date, t.end_date].filter(Boolean).join(" al ")].filter(Boolean).join(" · ")}</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={`/torneos/${t.id}/${c.id}`} className="card flex items-center justify-between hover:shadow-md">
              <span className="font-semibold">
                {c.name} <span className="font-normal text-gray-500">· {GENDER_LABEL[c.gender as "F"]}</span>
              </span>
              <span className="text-sm text-gray-500">{STATUS[c.status as keyof typeof STATUS]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
