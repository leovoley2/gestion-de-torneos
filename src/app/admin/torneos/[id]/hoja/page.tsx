import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCategoryView, isUuid, type Tournament } from "@/lib/data";
import { sql } from "@/lib/db";
import { makeDescribe } from "@/components/StageView";
import { PrintButton } from "@/components/PrintButton";
import { NO_COURT, dayOf, groupByDayAndCourt, type SheetMatch } from "@/lib/court-sheet";

export const metadata = { title: "Hoja de partidos · Panel" };
export const dynamic = "force-dynamic";

const TZ = "America/Lima";
const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "—");
const dayLabel = (d: string) =>
  d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "Sin horario";

/** Hoja de partidos por cancha para árbitros y mesa (se imprime o se guarda como PDF). */
export default async function CourtSheet({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ dia?: string; cancha?: string; jugados?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const admin = await requireAdmin();
  if (!isUuid(id)) notFound();
  if (!can(admin.grants, "results.edit", id) && !can(admin.grants, "tournament.edit", id)) notFound();
  const [t] = await sql<Tournament[]>`select * from tournaments where id = ${id}`;
  if (!t) notFound();
  const cats = await sql<{ id: string }[]>`select id from categories where tournament_id = ${id} and generated is not null order by created_at`;

  const all: SheetMatch[] = [];
  for (const { id: catId } of cats) {
    const view = await getCategoryView(catId, { includeDrafts: true });
    if (!view?.state || !view.category.generated) continue;
    const names = new Map(view.teamRefs.map((r) => [r.id, r.name]));
    const teamName = (tid: string | null) => (tid ? (names.get(tid) ?? "—") : "—");
    const describe = makeDescribe(view.category.generated, teamName);
    for (const m of view.state.matches) {
      if (m.status === "cancelled") continue;
      const s = view.schedule[m.key];
      // Entran los programados y los que ya tienen las dos duplas definidas.
      if (!s?.scheduled_at && !s?.court && m.status !== "ready") continue;
      all.push({
        key: `${catId}-${m.key}`,
        categoryName: view.category.name,
        number: m.number,
        label: m.label,
        teamA: m.teamA ? teamName(m.teamA) : describe(m.a),
        teamB: m.teamB ? teamName(m.teamB) : describe(m.b),
        court: s?.court ?? null,
        scheduledAt: s?.scheduled_at ?? null,
        score:
          m.status === "finished" && m.result
            ? m.result.walkoverWinner
              ? "W.O."
              : m.result.sets.map((x) => `${x.a}-${x.b}`).join(", ")
            : null,
      });
    }
  }

  const days = [...new Set(all.map((m) => dayOf(m.scheduledAt)))].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  const courts = [...new Set(all.map((m) => m.court?.trim() || NO_COURT))].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const showPlayed = sp.jugados === "1";
  const filtered = all.filter(
    (m) =>
      (sp.dia === undefined || sp.dia === "todos" || dayOf(m.scheduledAt) === sp.dia) &&
      (!sp.cancha || (m.court?.trim() || NO_COURT) === sp.cancha) &&
      (showPlayed || !m.score),
  );
  const groups = groupByDayAndCourt(filtered);

  return (
    <div className="space-y-6 print:space-y-0">
      <style>{`@page { size: A4 landscape; margin: 10mm; }`}</style>
      <div className="space-y-4 print:hidden">
        <Link href={`/admin/torneos/${id}`} className="text-sm font-medium text-sky-700">
          ← {t.name}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy-900">Hoja de partidos por cancha</h1>
            <p className="text-sm text-navy-500">Para árbitros y mesa. Cada cancha sale en una hoja aparte al imprimir.</p>
          </div>
          <PrintButton />
        </div>
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <select name="dia" defaultValue={sp.dia ?? "todos"} className="input w-auto py-1.5" aria-label="Día">
            <option value="todos">Todos los días</option>
            {days.map((d) => (
              <option key={d} value={d}>
                {dayLabel(d)}
              </option>
            ))}
          </select>
          <select name="cancha" defaultValue={sp.cancha ?? ""} className="input w-auto py-1.5" aria-label="Cancha">
            <option value="">Todas las canchas</option>
            {courts.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-navy-600">
            <input type="checkbox" name="jugados" value="1" defaultChecked={showPlayed} className="accent-navy-800" /> Incluir jugados
          </label>
          <button className="btn py-1.5">Ver</button>
        </form>
      </div>

      {groups.length === 0 && (
        <p className="card text-center text-navy-400">No hay partidos programados con estos filtros.</p>
      )}

      {groups.flatMap((d) =>
        d.courts.map((c, i) => (
          <section key={`${d.day}-${c.court}`} className={`card print:rounded-none print:border-0 print:p-0 print:shadow-none ${i > 0 || d !== groups[0] ? "print:break-before-page" : ""}`}>
            <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-navy-100 pb-2">
              <h2 className="text-xl font-bold text-navy-900">{c.court}</h2>
              <p className="text-sm text-navy-600 first-letter:uppercase">
                {t.name} · {dayLabel(d.day)}
              </p>
            </header>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-navy-500">
                  <th className="border-b border-navy-200 py-1.5 pr-2">Hora</th>
                  <th className="border-b border-navy-200 py-1.5 pr-2">Categoría · partido</th>
                  <th className="border-b border-navy-200 py-1.5 pr-2">Dupla A</th>
                  <th className="border-b border-navy-200 py-1.5 pr-2">Dupla B</th>
                  <th className="w-16 border-b border-navy-200 py-1.5 text-center">Set 1</th>
                  <th className="w-16 border-b border-navy-200 py-1.5 text-center">Set 2</th>
                  <th className="w-16 border-b border-navy-200 py-1.5 text-center">Set 3</th>
                  <th className="w-28 border-b border-navy-200 py-1.5 text-center">Firma árbitro</th>
                </tr>
              </thead>
              <tbody>
                {c.matches.map((m) => (
                  <tr key={m.key} className="break-inside-avoid align-top">
                    <td className="border-b border-navy-100 py-2.5 pr-2 font-semibold tabular-nums">{time(m.scheduledAt)}</td>
                    <td className="border-b border-navy-100 py-2.5 pr-2">
                      {m.categoryName}
                      <span className="block text-xs text-navy-500">
                        P{m.number} · {m.label}
                      </span>
                    </td>
                    <td className="border-b border-navy-100 py-2.5 pr-2 font-medium">{m.teamA}</td>
                    <td className="border-b border-navy-100 py-2.5 pr-2 font-medium">{m.teamB}</td>
                    {m.score ? (
                      <td colSpan={3} className="border-b border-navy-100 py-2.5 text-center font-semibold tabular-nums">
                        {m.score}
                      </td>
                    ) : (
                      [0, 1, 2].map((k) => (
                        <td key={k} className="border-b border-navy-100 px-1 py-2.5">
                          <span className="block h-7 rounded border border-navy-300" />
                        </td>
                      ))
                    )}
                    <td className="border-b border-navy-100 px-1 py-2.5">
                      <span className="block h-7 border-b border-navy-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )),
      )}
    </div>
  );
}
