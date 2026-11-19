import Link from "next/link";
import type { CategoryView } from "@/lib/data";
import { getCategoryFinals, getPointTables, getRankings } from "@/lib/ranking";
import { formatPoints } from "@/lib/ranking-calc";
import { CategoryRankingForm, PositionInput } from "./RankingPanelControls";

/** A qué ranking suma la categoría, y sus posiciones finales con los puntos que reparte. */
export async function RankingPanel({ view, canEdit }: { view: CategoryView; canEdit: boolean }) {
  const { category } = view;
  const [rankings, tables, finals] = await Promise.all([getRankings(), getPointTables(), getCategoryFinals(view)]);
  const ranking = rankings.find((r) => r.id === category.ranking_id);
  const table = tables.find((t) => t.id === category.point_table_id);
  const finished = category.status === "finished";

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-navy-900">Ranking y posiciones finales</h2>
          <p className="mt-0.5 text-sm text-navy-400">
            {ranking ? (
              <>
                Suma a <Link href={`/ranking/${ranking.id}`} target="_blank" className="font-semibold text-sky-600">{ranking.name} {ranking.season} ↗</Link>{" "}
                con la tabla <strong>{table?.name ?? "—"}</strong>.{" "}
                {finished ? "Ya está sumando." : "Sumará cuando la categoría termine."}
              </>
            ) : (
              "Esta categoría no suma a ningún ranking."
            )}
          </p>
        </div>
      </div>

      {canEdit && (
        <CategoryRankingForm
          categoryId={category.id}
          rankingId={category.ranking_id}
          tableId={category.point_table_id}
          rankings={rankings.filter((r) => r.gender === category.gender).map((r) => ({ id: r.id, label: `${r.name} ${r.season}` }))}
          tables={tables.map((t) => ({ id: t.id, label: t.name }))}
        />
      )}

      {finals && finals.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-navy-400">
              <tr className="border-b border-navy-50">
                <th className="py-2 pr-2 font-medium">Puesto</th>
                <th className="py-2 pr-2 font-medium">Dupla</th>
                <th className="py-2 pr-2 text-right font-medium">Puntos dupla</th>
                <th className="py-2 text-right font-medium">Cada jugador</th>
              </tr>
            </thead>
            <tbody>
              {finals.map((f) => (
                <tr key={f.teamId} className="border-b border-navy-50 last:border-0">
                  <td className="py-1.5 pr-2">
                    {canEdit ? (
                      <PositionInput key={`${f.teamId}-${f.position}-${f.overridden}`} categoryId={category.id} teamId={f.teamId} position={f.position} computed={f.computed} overridden={f.overridden} />
                    ) : (
                      <span className="font-semibold tabular-nums">{f.position}º</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-navy-900">
                    {f.label}
                    {f.athleteIds.some((a) => !a) && (
                      <span className="ml-2 text-xs text-amber-700" title="Agrega la dupla eligiendo atletas para que sume al ranking">
                        sin atletas vinculados
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{table ? formatPoints(f.pairPoints) : "—"}</td>
                  <td className="py-1.5 text-right font-semibold text-navy-800 tabular-nums">{table ? formatPoints(f.pairPoints / 2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-navy-400">
            Las posiciones se calculan solas al cargar resultados. Corrígelas solo si hace falta (p. ej. una dupla
            descalificada); las corregidas se marcan con ✎.
          </p>
        </div>
      )}
    </section>
  );
}
