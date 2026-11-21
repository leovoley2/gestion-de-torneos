import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { GENDER_LABEL, getCategoryView } from "@/lib/data";
import { formatRange } from "@/lib/format";
import { StageView, makeDescribe, type Helpers } from "@/components/StageView";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Llaves para imprimir · Panel" };

// Hoja A4 horizontal con márgenes de 10 mm ≈ 1040 px; cada ronda de la llave mide 288 px + 16 de separación.
const PAGE_WIDTH_PX = 1040;
const COLUMN_PX = 304;
const MIN_ZOOM = 0.7;
export const dynamic = "force-dynamic";

/** Grupos, tablas y llaves de una categoría en formato de impresión (o "Guardar como PDF"). */
export default async function PrintCategory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await requireAdmin();
  const view = await getCategoryView(id, { includeDrafts: true });
  if (!view) notFound();
  const { category, tournament, teams, teamRefs, state, schedule } = view;
  const t = tournament.id;
  if (!can(admin.grants, "tournament.edit", t) && !can(admin.grants, "results.edit", t) && !can(admin.grants, "registrations.review", t)) {
    notFound();
  }
  const names = new Map(teamRefs.map((r) => [r.id, r.name]));
  const teamName = (tid: string | null) => (tid ? (names.get(tid) ?? "—") : "—");
  const helpers: Helpers | null = category.generated
    ? {
        teamName,
        describe: makeDescribe(category.generated, teamName),
        info: (k) => ({ court: schedule[k]?.court, scheduledAt: schedule[k]?.scheduled_at }),
      }
    : null;

  return (
    <div className="space-y-6">
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <Link href={`/admin/categorias/${id}`} className="text-sm font-medium text-sky-700">
            ← {category.name}
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">Llaves para imprimir</h1>
          <p className="text-sm text-navy-500">En el diálogo de impresión elige “Guardar como PDF” para obtener el archivo.</p>
        </div>
        <PrintButton />
      </div>

      <header className="border-b border-navy-200 pb-3">
        <p className="text-xs font-semibold tracking-wider text-navy-500 uppercase">
          {tournament.name} · {[tournament.city, formatRange(tournament.start_date, tournament.end_date)].filter(Boolean).join(" · ")}
        </p>
        <h2 className="text-2xl font-bold text-navy-900">
          {category.name} <span className="text-base font-medium text-navy-500">({GENDER_LABEL[category.gender]})</span>
        </h2>
      </header>

      {!state || !helpers || !category.format ? (
        <p className="text-navy-500">Esta categoría todavía no tiene formato.</p>
      ) : (
        category.format.stages.map((s, i) => {
          // Al imprimir, la llave se achica para que todas sus rondas entren en el ancho de la hoja.
          const cols = new Set(state.matches.filter((m) => m.stageKey === s.key && !m.groupKey).map((m) => `${m.bracket}|${m.round}`)).size;
          // Las rondas se reparten el ancho; el zoom nunca baja de MIN_ZOOM para que se lean los nombres.
          const zoom = cols > 0 ? Math.max(MIN_ZOOM, Math.min(1, PAGE_WIDTH_PX / (cols * COLUMN_PX))) : 1;
          return (
            <div
              key={s.key}
              className={`print-zoom ${i > 0 ? "print:break-before-page" : ""}`}
              style={{ "--print-zoom": zoom.toFixed(3) } as React.CSSProperties}
            >
              <StageView stage={s} gen={category.generated!} state={state} helpers={helpers} />
            </div>
          );
        })
      )}

      <section className="break-inside-avoid print:break-before-page">
        <h3 className="mb-2 font-semibold text-navy-900">Duplas ({teams.length})</h3>
        <ol className="columns-1 gap-6 text-sm sm:columns-2 print:columns-2">
          {teams.map((tm) => (
            <li key={tm.id} className="break-inside-avoid py-0.5">
              <span className="inline-block w-7 font-semibold text-navy-500 tabular-nums">{tm.seed}.</span>
              {tm.player1} / {tm.player2}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
