import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ROLE_INFO, can } from "@/lib/permissions";
import {
  buildTasks,
  getDashboard,
  type Task,
} from "@/lib/admin-dashboard";
import { PageTitle } from "@/components/AdminUI";
import { createTournament } from "./actions";
import { TournamentList } from "./TournamentList";

export const metadata = { title: "Panel · Torneos Vóley Playa" };

const TASK_ICON: Record<Task["kind"], string> = {
  review: "✎",
  today: "⏱",
  format: "⚙",
  publish: "◉",
};

export default async function AdminHome() {
  const admin = await requireAdmin();
  const canCreate = can(admin.grants, "tournament.create");
  const { tournaments, categories, archived } = await getDashboard(admin.grants);
  const tasks = buildTasks(admin.grants, tournaments, categories);

  const live = tournaments.filter((t) => t.phase === "live").length;
  const upcoming = tournaments.filter((t) => t.phase === "upcoming").length;
  const reviews = categories.reduce((n, c) => n + c.pending_reviews, 0);
  const today = categories.reduce((n, c) => n + c.today_pending, 0);
  const roles = [...new Set(admin.grants.map((g) => ROLE_INFO[g.role].label))];
  const firstName = (admin.name || "").split(" ")[0];

  const stats: [string, number, string?][] = [
    ["En curso", live],
    ["Próximos", upcoming],
    [
      "Inscripciones por revisar",
      reviews,
      reviews > 0 ? "text-amber-600" : undefined,
    ],
    [
      "Partidos de hoy sin resultado",
      today,
      today > 0 ? "text-amber-600" : undefined,
    ],
  ];

  return (
    <div className="space-y-8">
      <PageTitle
        eyebrow={roles.join(" · ") || "Panel de administración"}
        title={firstName ? `Hola, ${firstName}` : "Panel de administración"}
        actions={
          canCreate && (
            <a href="#nuevo-torneo" className="btn-primary">
              + Nuevo torneo
            </a>
          )
        }
      />

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(([label, value, tone], i) => (
          <div
            key={label}
            className="card rise px-4 py-3"
            style={{ "--i": i } as React.CSSProperties}
          >
            <dt className="text-[11px] font-medium text-navy-400">{label}</dt>
            <dd
              className={`mt-0.5 text-2xl font-bold tabular-nums ${tone ?? "text-navy-900"}`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          {tasks.length > 0 && (
            <div className="lg:hidden">
              <Pending tasks={tasks} />
            </div>
          )}
          <TournamentList tournaments={tournaments} archived={archived} />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          <div className="hidden lg:block">
            <Pending tasks={tasks} />
          </div>

          {canCreate && (
            <form
              id="nuevo-torneo"
              action={createTournament}
              className="card scroll-mt-24 space-y-4"
            >
              <h2 className="font-semibold text-navy-900">Nuevo torneo</h2>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-navy-700">
                  Nombre
                </span>
                <input
                  name="name"
                  required
                  placeholder="Ej. Circuito Nacional – Etapa Máncora"
                  className="input"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-navy-700">
                  Ciudad o playa
                </span>
                <input
                  name="city"
                  placeholder="Ej. Máncora"
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
              <button className="btn-primary w-full py-2.5">
                Crear torneo
              </button>
              <p className="text-xs text-navy-400">
                Se crea como borrador. Para otra etapa del circuito, abre un
                torneo anterior y usa “Duplicar”.
              </p>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}

function Pending({ tasks }: { tasks: Task[] }) {
  return (
    <section className="card" aria-label="Pendientes">
      <h2 className="font-semibold text-navy-900">
        Pendientes
        {tasks.length > 0 && (
          <span className="ml-2 rounded-full bg-navy-50 px-2 py-0.5 text-xs font-semibold text-navy-600 tabular-nums">
            {tasks.length}
          </span>
        )}
      </h2>
      {tasks.length === 0 ? (
        <p className="mt-2 text-sm text-navy-400">Todo al día ✓</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {tasks.slice(0, 12).map((t, i) => (
            <li key={i}>
              <Link
                href={t.href}
                className="flex items-start gap-3 rounded-xl px-2.5 py-2 transition-colors duration-150 hover:bg-sky-50"
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs ${
                    t.urgent
                      ? "bg-amber-100 text-amber-700"
                      : "bg-navy-50 text-navy-500"
                  }`}
                >
                  {TASK_ICON[t.kind]}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-navy-900">
                    {t.title}
                  </span>
                  <span className="block truncate text-xs text-navy-400">
                    {t.detail}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {tasks.length > 12 && (
            <li className="px-2.5 text-xs text-navy-400">
              y {tasks.length - 12} más…
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
