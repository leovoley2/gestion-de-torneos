import Link from "next/link";
import { notFound } from "next/navigation";
import { GENDER_LABEL, getCategoryView } from "@/lib/data";
import { requireAdmin } from "@/lib/auth";
import { StageView, makeDescribe } from "@/components/StageView";
import { ConfirmButton } from "@/components/ConfirmButton";
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

  return (
    <div className="space-y-6">
      <Link href={`/admin/torneos/${tournament.id}`} className="text-sm text-sky-700 hover:underline">
        ← {tournament.name}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">
          {category.name} <span className="font-normal text-gray-500">· {GENDER_LABEL[category.gender]}</span>
        </h1>
        {tournament.published && (
          <Link href={`/torneos/${tournament.id}/${category.id}`} target="_blank" className="btn">
            Ver público ↗
          </Link>
        )}
      </div>

      <TeamsManager categoryId={category.id} teams={teams} locked={hasFormat} />

      {!hasFormat && teams.length >= 2 && <FormatBuilder categoryId={category.id} teams={teamRefs} />}
      {!hasFormat && teams.length < 2 && (
        <p className="card text-sm text-gray-600">Agrega al menos 2 duplas para configurar el formato.</p>
      )}

      {hasFormat && state && category.format && category.generated && (
        <>
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
          <ConfirmButton
            action={resetFormat.bind(null, category.id)}
            message="¿Reiniciar el formato? Se borran todos los partidos, resultados y programación de esta categoría."
          >
            Reiniciar formato
          </ConfirmButton>
        </>
      )}

      <ConfirmButton
        action={deleteCategory.bind(null, category.id, tournament.id)}
        message="¿Eliminar la categoría con sus duplas y resultados?"
      >
        Eliminar categoría
      </ConfirmButton>
    </div>
  );
}
