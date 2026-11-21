import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { GENDER_LABEL } from "@/lib/data";
import { sql } from "@/lib/db";
import { can } from "@/lib/permissions";
import { getPointTables, getRankings } from "@/lib/ranking";
import { PageTitle, SectionTitle } from "@/components/AdminUI";
import { CreateRankingForm, PointTableEditor, RankingRowControls } from "./RankingControls";

export const metadata = { title: "Ranking · Panel" };

export default async function AdminRankingPage() {
  const me = await getAdmin();
  if (!me || !can(me.grants, "ranking.manage")) notFound();
  const [rankings, tables, usage] = await Promise.all([
    getRankings(),
    getPointTables(),
    sql<{ ranking_id: string; n: number; finished: number }[]>`
      select c.ranking_id, count(*)::int as n,
        count(*) filter (where c.status = 'finished' and t.published)::int as finished
      from categories c join tournaments t on t.id = c.tournament_id
      where c.ranking_id is not null group by c.ranking_id`,
  ]);
  const used = new Map(usage.map((u) => [u.ranking_id, u]));

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Panel de administración" title="Ranking del circuito">
        <p className="mt-2 max-w-2xl text-sm text-navy-400">
          Cada categoría de torneo indica a qué ranking suma y con qué tabla de puntos. Al terminar, los puntos de cada
          dupla se reparten por la mitad entre sus dos jugadores. Solo suman los torneos publicados. El ranking se actualiza solo.
        </p>
      </PageTitle>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <section className="card">
          <SectionTitle title="Rankings" hint="Uno por rama y temporada (p. ej. Nacional Femenino 2026)." />
          <ul className="space-y-2">
            {rankings.map((r) => {
              const u = used.get(r.id);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-100/70 px-4 py-3">
                  <div>
                    <p className="font-semibold text-navy-900">
                      {r.name} <span className="font-normal text-navy-400">· {r.season}</span>
                    </p>
                    <p className="text-sm text-navy-400">
                      {GENDER_LABEL[r.gender]} · {u ? `${u.finished} de ${u.n} categorías terminadas y publicadas suman` : "ninguna categoría suma todavía"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/ranking/${r.id}`} target="_blank" className="btn px-3 py-1.5 text-xs">
                      Ver ↗
                    </Link>
                    <RankingRowControls rankingId={r.id} published={r.published} />
                  </div>
                </li>
              );
            })}
            {rankings.length === 0 && <li className="text-sm text-navy-400">Todavía no hay rankings.</li>}
          </ul>
        </section>
        <CreateRankingForm />
      </div>

      <section className="space-y-4">
        <SectionTitle
          title="Tablas de puntos"
          hint="Puntos de la DUPLA por puesto final. Si varias duplas empatan en un puesto, reciben el promedio de los puestos que ocupan."
        />
        <div className="grid gap-4 lg:grid-cols-2">
          {tables.map((t) => (
            <PointTableEditor key={t.id} table={t} />
          ))}
          <PointTableEditor table={null} />
        </div>
      </section>
    </div>
  );
}
