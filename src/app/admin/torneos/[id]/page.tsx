import Link from "next/link";
import { notFound } from "next/navigation";
import { GENDER_LABEL, isUuid, type Category, type Tournament } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";
import { sql } from "@/lib/db";
import { createCategory, deleteTournament, setPublished, updateTournament } from "../../actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageTitle, PublishedBadge, SectionTitle } from "@/components/AdminUI";
import { PhaseBadge } from "@/components/PhaseBadge";

const STATUS = {
  setup: { label: "Preparando", phase: "upcoming" },
  in_progress: { label: "En juego", phase: "live" },
  finished: { label: "Terminado", phase: "past" },
} as const;

export default async function AdminTournament({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  if (!isUuid(id)) notFound();
  const [t] = await sql<Tournament[]>`select * from tournaments where id = ${id}`;
  if (!t) notFound();
  const categories = await sql<(Pick<Category, "id" | "name" | "gender" | "status"> & { teams: number })[]>`
    select c.id, c.name, c.gender, c.status, (select count(*)::int from teams where category_id = c.id) as teams
    from categories c where c.tournament_id = ${id} order by c.created_at`;

  return (
    <div className="space-y-6">
      <PageTitle
        back={{ href: "/admin", label: "Torneos" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t.name} <PublishedBadge published={t.published} />
          </span>
        }
        actions={
          <>
            {t.published && (
              <Link href={`/torneos/${t.id}`} className="btn" target="_blank">
                Ver público ↗
              </Link>
            )}
            <form action={setPublished.bind(null, t.id, !t.published)}>
              <button className={t.published ? "btn" : "btn-primary"}>{t.published ? "Despublicar" : "Publicar"}</button>
            </form>
          </>
        }
      >
        <p className="mt-2 text-sm text-navy-400">
          {t.published
            ? "Cualquiera con el enlace ve duplas, programación y resultados."
            : "Borrador: solo los administradores lo ven."}
        </p>
      </PageTitle>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <section className="card">
          <SectionTitle title="Categorías" hint="Cada categoría tiene sus duplas, su formato y sus resultados." />
          <ul className="space-y-2">
            {categories.map((c) => {
              const s = STATUS[c.status as keyof typeof STATUS];
              return (
                <li key={c.id}>
                  <Link
                    href={`/admin/categorias/${c.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-navy-100/70 px-4 py-3 transition-colors duration-150 hover:border-sky-200 hover:bg-sky-50/50"
                  >
                    <span>
                      <span className="block font-semibold text-navy-900">{c.name}</span>
                      <span className="text-sm text-navy-400">
                        {GENDER_LABEL[c.gender as "F"]} · {c.teams} {c.teams === 1 ? "dupla" : "duplas"}
                      </span>
                    </span>
                    <PhaseBadge phase={s.phase}>{s.label}</PhaseBadge>
                  </Link>
                </li>
              );
            })}
            {categories.length === 0 && <li className="text-sm text-navy-400">Todavía no hay categorías.</li>}
          </ul>
          <form
            action={createCategory.bind(null, t.id)}
            className="mt-5 flex flex-wrap items-end gap-2 border-t border-navy-50 pt-5"
          >
            <label className="block min-w-48 flex-1 text-sm">
              <span className="mb-1.5 block font-medium text-navy-700">Nueva categoría</span>
              <input name="name" required placeholder="Ej. Open, Sub-19" className="input" />
            </label>
            <select name="gender" className="input w-auto" aria-label="Rama">
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
              <option value="X">Mixto</option>
            </select>
            <button className="btn-primary">Agregar</button>
          </form>
        </section>

        <div className="space-y-6">
          <form action={updateTournament.bind(null, t.id)} className="card space-y-4">
            <SectionTitle title="Datos del torneo" />
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-navy-700">Nombre</span>
              <input name="name" defaultValue={t.name} required className="input" />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-navy-700">Ciudad o playa</span>
              <input name="city" defaultValue={t.city ?? ""} className="input" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-navy-700">Inicio</span>
                <input name="start_date" type="date" defaultValue={t.start_date ?? ""} className="input" />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-navy-700">Fin</span>
                <input name="end_date" type="date" defaultValue={t.end_date ?? ""} className="input" />
              </label>
            </div>
            <button className="btn w-full">Guardar datos</button>
          </form>

          <div className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
            <h2 className="text-sm font-semibold text-red-800">Zona de riesgo</h2>
            <p className="mt-1 mb-3 text-xs text-red-700/80">Borra el torneo con todas sus categorías y resultados.</p>
            <ConfirmButton
              action={deleteTournament.bind(null, t.id)}
              message="¿Eliminar el torneo con todas sus categorías y resultados? No se puede deshacer."
            >
              Eliminar torneo
            </ConfirmButton>
          </div>
        </div>
      </div>
    </div>
  );
}
