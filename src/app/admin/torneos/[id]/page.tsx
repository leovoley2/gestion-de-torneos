import Link from "next/link";
import { notFound } from "next/navigation";
import { GENDER_LABEL, isUuid, type Tournament } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";
import { can, visibleTournaments } from "@/lib/permissions";
import { sql } from "@/lib/db";
import {
  createCategory,
  deleteTournament,
  duplicateTournament,
  setPublished,
  updateTournament,
} from "../../actions";
import { getCategorySummaries, progressOf } from "@/lib/admin-dashboard";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageTitle, PublishedBadge, SectionTitle } from "@/components/AdminUI";
import { PhaseBadge } from "@/components/PhaseBadge";

const STATUS = {
  setup: { label: "Preparando", phase: "upcoming" },
  in_progress: { label: "En juego", phase: "live" },
  finished: { label: "Terminado", phase: "past" },
} as const;

export default async function AdminTournament({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!isUuid(id)) notFound();
  const visible = visibleTournaments(admin.grants);
  if (visible !== null && !visible.includes(id)) notFound();
  const canEdit = can(admin.grants, "tournament.edit", id);
  const [t] = await sql<
    Tournament[]
  >`select * from tournaments where id = ${id}`;
  if (!t) notFound();
  const canDuplicate = canEdit && can(admin.grants, "tournament.create");
  const categories = await getCategorySummaries(admin.grants, [id]);

  return (
    <div className="space-y-6">
      <PageTitle
        back={{ href: "/admin", label: "Inicio" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t.name} <PublishedBadge published={t.published} />
          </span>
        }
        actions={
          <>
            {(canEdit || can(admin.grants, "results.edit", id)) && (
              <Link href={`/admin/torneos/${t.id}/hoja`} className="btn">
                Hoja por cancha
              </Link>
            )}
            {can(admin.grants, "registrations.review", id) && (
              <a href={`/api/admin/torneos/${t.id}/inscritos`} className="btn">
                Excel de inscritos
              </a>
            )}
            {t.published && (
              <Link href={`/torneos/${t.id}`} className="btn" target="_blank">
                Ver público ↗
              </Link>
            )}
            {canEdit && (
              <form action={setPublished.bind(null, t.id, !t.published)}>
                <button className={t.published ? "btn" : "btn-primary"}>
                  {t.published ? "Despublicar" : "Publicar"}
                </button>
              </form>
            )}
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
          <SectionTitle
            title="Categorías"
            hint="Cada categoría tiene sus duplas, su formato y sus resultados."
          />
          <ul className="space-y-2">
            {categories.map((c) => {
              const s = STATUS[c.status];
              const pct = Math.round(progressOf(c) * 100);
              return (
                <li key={c.id}>
                  <Link
                    href={`/admin/categorias/${c.id}`}
                    className="block rounded-xl border border-navy-100/70 px-4 py-3 transition-colors duration-150 hover:border-sky-200 hover:bg-sky-50/50"
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-navy-900">
                          {c.name}
                        </span>
                        <span className="text-sm text-navy-400">
                          {GENDER_LABEL[c.gender]} · {c.teams}{" "}
                          {c.teams === 1 ? "dupla" : "duplas"}
                          {c.matches > 0 &&
                            ` · ${Math.min(c.results, c.matches)}/${c.matches} partidos`}
                        </span>
                      </span>
                      <PhaseBadge phase={s.phase}>{s.label}</PhaseBadge>
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                      {c.registration_open && (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700 ring-1 ring-sky-200 ring-inset">
                          Inscripciones abiertas
                        </span>
                      )}
                      {c.registration_expired && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 ring-1 ring-amber-200 ring-inset">
                          Inscripción cerrada: venció la fecha límite
                        </span>
                      )}
                      {c.pending_reviews > 0 && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 ring-1 ring-amber-200 ring-inset">
                          {c.pending_reviews} por revisar
                        </span>
                      )}
                      {c.today_pending > 0 && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 ring-1 ring-amber-200 ring-inset">
                          {c.today_pending} de hoy sin resultado
                        </span>
                      )}
                      {!c.has_format && c.teams >= 2 && (
                        <span className="rounded-full bg-navy-50 px-2 py-0.5 text-navy-600 ring-1 ring-navy-100 ring-inset">
                          Falta el formato
                        </span>
                      )}
                      {c.teams < 2 && (
                        <span className="rounded-full bg-navy-50 px-2 py-0.5 text-navy-500 ring-1 ring-navy-100 ring-inset">
                          Faltan duplas
                        </span>
                      )}
                    </span>
                    {c.has_format && (
                      <span
                        className="mt-2 block h-1.5 overflow-hidden rounded-full bg-navy-50"
                        aria-hidden="true"
                      >
                        <span
                          className="block h-full rounded-full bg-sky-500"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
            {categories.length === 0 && (
              <li className="text-sm text-navy-400">
                Todavía no hay categorías.
              </li>
            )}
          </ul>
          {canEdit && (
            <form
              action={createCategory.bind(null, t.id)}
              className="mt-5 flex flex-wrap items-end gap-2 border-t border-navy-50 pt-5"
            >
              <label className="block min-w-48 flex-1 text-sm">
                <span className="mb-1.5 block font-medium text-navy-700">
                  Nueva categoría
                </span>
                <input
                  name="name"
                  required
                  placeholder="Ej. Open, Sub-19"
                  className="input"
                />
              </label>
              <select name="gender" className="input w-auto" aria-label="Rama">
                <option value="F">Femenino</option>
                <option value="M">Masculino</option>
                <option value="X">Mixto</option>
              </select>
              <button className="btn-primary">Agregar</button>
            </form>
          )}
        </section>

        {canEdit && (
          <div className="space-y-6">
            <form
              action={updateTournament.bind(null, t.id)}
              className="card space-y-4"
            >
              <SectionTitle title="Datos del torneo" />
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-navy-700">
                  Nombre
                </span>
                <input
                  name="name"
                  defaultValue={t.name}
                  required
                  className="input"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-navy-700">
                  Ciudad o playa
                </span>
                <input
                  name="city"
                  defaultValue={t.city ?? ""}
                  className="input"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-navy-700">
                    Inicio
                  </span>
                  <input
                    name="start_date"
                    type="date"
                    defaultValue={t.start_date ?? ""}
                    className="input"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-medium text-navy-700">
                    Fin
                  </span>
                  <input
                    name="end_date"
                    type="date"
                    defaultValue={t.end_date ?? ""}
                    className="input"
                  />
                </label>
              </div>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-navy-700">
                  Cómo pagar la inscripción
                </span>
                <textarea
                  name="payment_instructions"
                  defaultValue={t.payment_instructions ?? ""}
                  rows={3}
                  maxLength={1000}
                  placeholder={"Ej. Yape al 999 999 999 (Federación)\nBCP cta. 191-..., CCI ..."}
                  className="input"
                />
                <span className="mt-1 block text-xs text-navy-400">
                  Lo ven los atletas al inscribirse. El monto se define en cada categoría.
                </span>
              </label>
              <button className="btn w-full">Guardar datos</button>
            </form>

            {canDuplicate && (
              <details className="card group">
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-navy-900">
                  Duplicar para otra etapa
                  <span
                    className="text-navy-400 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  >
                    ⌄
                  </span>
                </summary>
                <form
                  action={duplicateTournament.bind(null, t.id)}
                  className="mt-4 space-y-3"
                >
                  <p className="text-sm text-navy-400">
                    Crea un torneo nuevo con las mismas {categories.length}{" "}
                    categorías (rama, cupo, edades, ranking y tabla de puntos),
                    sin duplas ni resultados. Queda en borrador.
                  </p>
                  <label className="block text-sm">
                    <span className="mb-1.5 block font-medium text-navy-700">
                      Nombre
                    </span>
                    <input
                      name="name"
                      required
                      defaultValue={`${t.name} (copia)`}
                      className="input"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1.5 block font-medium text-navy-700">
                      Ciudad o playa
                    </span>
                    <input
                      name="city"
                      defaultValue={t.city ?? ""}
                      className="input"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm">
                      <span className="mb-1.5 block font-medium text-navy-700">
                        Inicio
                      </span>
                      <input name="start_date" type="date" className="input" />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1.5 block font-medium text-navy-700">
                        Fin
                      </span>
                      <input name="end_date" type="date" className="input" />
                    </label>
                  </div>
                  <button className="btn-primary w-full">
                    Duplicar torneo
                  </button>
                </form>
              </details>
            )}

            <div className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
              <h2 className="text-sm font-semibold text-red-800">
                Zona de riesgo
              </h2>
              <p className="mt-1 mb-3 text-xs text-red-700/80">
                Borra el torneo con todas sus categorías y resultados.
              </p>
              <ConfirmButton
                action={deleteTournament.bind(null, t.id)}
                message="¿Eliminar el torneo con todas sus categorías y resultados? No se puede deshacer."
              >
                Eliminar torneo
              </ConfirmButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
