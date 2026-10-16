import Link from "next/link";
import { notFound } from "next/navigation";
import { GENDER_LABEL, isUuid, type Category, type Tournament } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { createCategory, deleteTournament, setPublished, updateTournament } from "../../actions";
import { ConfirmButton } from "@/components/ConfirmButton";

const STATUS = { setup: "Preparando", in_progress: "En juego", finished: "Terminado" } as const;

export default async function AdminTournament({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  if (!isUuid(id)) notFound();
  const [t] = await sql<Tournament[]>`select * from tournaments where id = ${id}`;
  if (!t) notFound();
  const categories = await sql<Pick<Category, "id" | "name" | "gender" | "status">[]>`
    select id, name, gender, status from categories where tournament_id = ${id} order by created_at`;

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-sky-700 hover:underline">
        ← Torneos
      </Link>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">{t.name}</h1>
          <div className="flex gap-2">
            {t.published && (
              <Link href={`/torneos/${t.id}`} className="btn" target="_blank">
                Ver público ↗
              </Link>
            )}
            <form action={setPublished.bind(null, t.id, !t.published)}>
              <button className={t.published ? "btn" : "btn-primary"}>
                {t.published ? "Despublicar" : "Publicar"}
              </button>
            </form>
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {t.published
            ? "Publicado: cualquiera con el enlace ve duplas, programación y resultados."
            : "Borrador: solo los administradores lo ven."}
        </p>

        <form action={updateTournament.bind(null, t.id)} className="mt-4 grid gap-2 sm:grid-cols-4">
          <input name="name" defaultValue={t.name} required className="input sm:col-span-2" />
          <input name="city" defaultValue={t.city ?? ""} placeholder="Ciudad / playa" className="input sm:col-span-2" />
          <input name="start_date" type="date" defaultValue={t.start_date ?? ""} className="input" />
          <input name="end_date" type="date" defaultValue={t.end_date ?? ""} className="input" />
          <button className="btn">Guardar datos</button>
        </form>
      </section>

      <section className="card">
        <h2 className="font-semibold">Categorías</h2>
        <ul className="mt-2 divide-y">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/admin/categorias/${c.id}`} className="flex justify-between py-2 hover:bg-gray-50">
                <span>
                  {c.name} <span className="text-sm text-gray-500">· {GENDER_LABEL[c.gender as "F"]}</span>
                </span>
                <span className="text-sm text-gray-500">{STATUS[c.status as keyof typeof STATUS]}</span>
              </Link>
            </li>
          ))}
        </ul>
        <form action={createCategory.bind(null, t.id)} className="mt-3 flex flex-wrap gap-2">
          <input name="name" required placeholder="Ej. Open, Sub-19" className="input max-w-xs" />
          <select name="gender" className="input max-w-[150px]">
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
            <option value="X">Mixto</option>
          </select>
          <button className="btn-primary">Agregar categoría</button>
        </form>
      </section>

      <ConfirmButton
        action={deleteTournament.bind(null, t.id)}
        message="¿Eliminar el torneo con todas sus categorías y resultados? No se puede deshacer."
      >
        Eliminar torneo
      </ConfirmButton>
    </div>
  );
}
