import Link from "next/link";
import { notFound } from "next/navigation";
import { GENDER_LABEL, getCategoryView } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";
import { StageView, makeDescribe } from "@/components/StageView";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PageTitle } from "@/components/AdminUI";
import { deleteCategory, resetFormat } from "@/app/admin/actions";
import { TeamsManager } from "./TeamsManager";
import { FormatBuilder } from "./FormatBuilder";
import { ResultsEditor } from "./ResultsEditor";

export default async function AdminCategory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  const view = await getCategoryView(id, { includeDrafts: true });
  if (!view) notFound();
  const { category, tournament, teams, teamRefs, state, schedule } = view;
  const hasFormat = Boolean(category.format && category.generated && state);

  const teamNames = Object.fromEntries(teamRefs.map((t) => [t.id, t.name]));
  const teamName = (tid: string | null) => (tid ? (teamNames[tid] ?? "—") : "—");
  const describe = category.generated ? makeDescribe(category.generated, teamName) : null;
  const describeByMatch = Object.fromEntries(
    (state?.matches ?? []).map((m) => [m.key, { a: describe!(m.a), b: describe!(m.b) }]),
  );

  const played = state?.matches.filter((m) => m.status === "finished").length ?? 0;
  const total = state?.matches.filter((m) => m.status !== "cancelled").length ?? 0;
  const step = !hasFormat ? (teams.length >= 2 ? 2 : 1) : 3;

  return (
    <div className="space-y-6">
      <PageTitle
        back={{ href: `/admin/torneos/${tournament.id}`, label: tournament.name }}
        eyebrow={GENDER_LABEL[category.gender]}
        title={category.name}
        actions={
          tournament.published && (
            <Link href={`/torneos/${tournament.id}/${category.id}`} target="_blank" className="btn">
              Ver público ↗
            </Link>
          )
        }
      />

      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Pasos">
        {["Duplas", "Formato", "Resultados"].map((label, i) => {
          const n = i + 1;
          const state = n < step ? "done" : n === step ? "current" : "todo";
          return (
            <li
              key={label}
              aria-current={state === "current" ? "step" : undefined}
              className={`flex items-center gap-2 rounded-full py-1 pr-3.5 pl-1 font-medium ring-1 ring-inset ${
                state === "current"
                  ? "bg-navy-800 text-white ring-navy-800"
                  : state === "done"
                    ? "bg-sky-50 text-navy-700 ring-sky-200"
                    : "bg-white text-navy-300 ring-navy-100"
              }`}
            >
              <span
                className={`grid size-6 place-items-center rounded-full text-xs font-bold ${
                  state === "current" ? "bg-sky-400 text-navy-950" : state === "done" ? "bg-sky-500 text-white" : "bg-navy-50"
                }`}
              >
                {state === "done" ? "✓" : n}
              </span>
              {label}
            </li>
          );
        })}
        {hasFormat && total > 0 && (
          <li className="ml-auto self-center text-xs font-medium text-navy-400 tabular-nums">
            {played} de {total} partidos jugados
          </li>
        )}
      </ol>

      {hasFormat && state && category.format && category.generated ? (
        <div className="grid items-start gap-6 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0 space-y-6">
            <ResultsEditor
              categoryId={category.id}
              format={category.format}
              matches={state.matches}
              teamNames={teamNames}
              describe={describeByMatch}
              schedule={schedule}
            />
            {category.format.stages.map((s) => (
              <StageView
                key={s.key}
                stage={s}
                gen={category.generated!}
                state={state}
                helpers={{
                  teamName,
                  describe: describe!,
                  info: (k) => ({ court: schedule[k]?.court, scheduledAt: schedule[k]?.scheduled_at }),
                }}
              />
            ))}
          </div>
          <aside className="space-y-6 xl:sticky xl:top-24">
            <TeamsManager categoryId={category.id} teams={teams} locked />
            <DangerZone>
              <ConfirmButton
                action={resetFormat.bind(null, category.id)}
                message="¿Reiniciar el formato? Se borran todos los partidos, resultados y programación de esta categoría."
              >
                Reiniciar formato
              </ConfirmButton>
              <ConfirmButton
                action={deleteCategory.bind(null, category.id, tournament.id)}
                message="¿Eliminar la categoría con sus duplas y resultados?"
              >
                Eliminar categoría
              </ConfirmButton>
            </DangerZone>
          </aside>
        </div>
      ) : (
        <>
          <TeamsManager categoryId={category.id} teams={teams} locked={false} />
          {teams.length >= 2 ? (
            <FormatBuilder categoryId={category.id} teams={teamRefs} />
          ) : (
            <p className="card text-sm text-navy-400">Agrega al menos 2 duplas para configurar el formato.</p>
          )}
          <DangerZone>
            <ConfirmButton
              action={deleteCategory.bind(null, category.id, tournament.id)}
              message="¿Eliminar la categoría con sus duplas y resultados?"
            >
              Eliminar categoría
            </ConfirmButton>
          </DangerZone>
        </>
      )}
    </div>
  );
}

function DangerZone({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-red-50/40 p-5">
      <h2 className="text-sm font-semibold text-red-800">Zona de riesgo</h2>
      <p className="mt-1 mb-3 text-xs text-red-700/80">Estas acciones borran datos y no se pueden deshacer.</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
