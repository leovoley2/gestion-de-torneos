import "server-only";
import { fullName, type Athlete } from "@/lib/athletes";
import { getCategoryView, type CategoryView } from "@/lib/data";
import { sql } from "@/lib/db";
import { finalStandings, tieSizes } from "@/lib/engine";
import { buildRanking, pairPointsFor, teamPoints, type CategoryResult, type PointRow, type RankingRow } from "@/lib/ranking-calc";

// El ranking se calcula al vuelo desde las categorías TERMINADAS de torneos PUBLICADOS que suman a él: posiciones finales
// (calculadas o corregidas a mano) → tabla de puntos → mitad para cada jugador. Si se corrige un
// resultado o una posición, el ranking cambia solo.

export interface Ranking {
  id: string;
  name: string;
  gender: "F" | "M" | "X";
  season: number;
  published: boolean;
}

export interface PointTable {
  id: string;
  name: string;
  rows: PointRow[];
}

export interface TeamFinal {
  teamId: string;
  label: string;
  athleteIds: [string | null, string | null];
  computed: number; // posición calculada
  position: number; // la que vale (corregida a mano o calculada)
  overridden: boolean;
  tieSize: number;
  pairPoints: number; // puntos de la dupla
}

export async function getRankings(onlyPublished = false): Promise<Ranking[]> {
  return sql<Ranking[]>`
    select id, name, gender, season, published from rankings
    where ${!onlyPublished} or published order by season desc, name`;
}

export async function getPointTables(): Promise<PointTable[]> {
  return sql<PointTable[]>`select id, name, rows from point_tables order by name`;
}

/** Posiciones finales de una categoría (con correcciones manuales) y los puntos que reparte. */
export async function getCategoryFinals(view: CategoryView): Promise<TeamFinal[] | null> {
  const { category, state, teams } = view;
  if (!category.format || !category.generated || !state) return null;
  const computed = finalStandings(category.format, category.generated, state, teams.map((t) => t.id));
  const overrides = new Map(
    (await sql<{ team_id: string; position: number }[]>`
      select team_id, position from final_positions where category_id = ${category.id}`).map((o) => [o.team_id, o.position]),
  );
  const [pt] = category.point_table_id
    ? await sql<{ rows: PointRow[] }[]>`select rows from point_tables where id = ${category.point_table_id}`
    : [];
  const effective = computed.map((c) => ({ teamId: c.teamId, position: overrides.get(c.teamId) ?? c.position }));
  const sizes = tieSizes(effective);
  return computed.map((c) => {
    const t = teams.find((x) => x.id === c.teamId)!;
    const position = overrides.get(c.teamId) ?? c.position;
    const tieSize = sizes.get(position) ?? 1;
    return {
      teamId: c.teamId,
      label: `${t.player1} / ${t.player2}`,
      athleteIds: [t.athlete1_id ?? null, t.athlete2_id ?? null] as [string | null, string | null],
      computed: c.position,
      position,
      overridden: overrides.has(c.teamId),
      tieSize,
      pairPoints: pt ? pairPointsFor(pt.rows, position, tieSize) : 0,
    };
  }).sort((a, b) => a.position - b.position);
}

export interface RankingView {
  ranking: Ranking;
  rows: (RankingRow & { name: string; club: string | null; city: string | null })[];
  categories: { id: string; label: string; date: string | null }[];
}

export async function computeRanking(rankingId: string): Promise<RankingView | null> {
  const [ranking] = await sql<Ranking[]>`select id, name, gender, season, published from rankings where id = ${rankingId}`;
  if (!ranking) return null;
  const cats = await sql<{ id: string; name: string; tournament_name: string; start_date: string | null }[]>`
    select c.id, c.name, t.name as tournament_name, t.start_date
    from categories c join tournaments t on t.id = c.tournament_id
    where c.ranking_id = ${rankingId} and c.status = 'finished' and c.point_table_id is not null
      and t.published -- un torneo en borrador no suma puntos hasta que se publique
    order by t.start_date nulls last`;

  const results: CategoryResult[] = [];
  for (const c of cats) {
    const view = await getCategoryView(c.id, { includeDrafts: true });
    if (!view) continue;
    const finals = await getCategoryFinals(view);
    const [pt] = await sql<{ rows: PointRow[] }[]>`select rows from point_tables where id = ${view.category.point_table_id!}`;
    if (!finals || !pt) continue;
    results.push({
      categoryId: c.id,
      label: `${c.tournament_name} · ${c.name}`,
      date: c.start_date,
      table: pt.rows,
      teams: finals.map((f) => ({ athleteIds: f.athleteIds, position: f.position, tieSize: f.tieSize })),
    });
  }

  const rows = buildRanking(results);
  const athletes = rows.length
    ? await sql<Pick<Athlete, "id" | "first_name" | "last_name" | "club" | "city">[]>`
        select id, first_name, last_name, club, city from athletes where id = any(${rows.map((r) => r.athleteId)}::uuid[])`
    : [];
  const byId = new Map(athletes.map((a) => [a.id, a]));
  return {
    ranking,
    rows: rows.map((r) => {
      const a = byId.get(r.athleteId);
      return { ...r, name: a ? fullName(a) : "—", club: a?.club ?? null, city: a?.city ?? null };
    }),
    categories: results.map((r) => ({ id: r.categoryId, label: r.label, date: r.date })),
  };
}

/** Puntos de ranking de cada dupla de una lista (suma de sus dos jugadores). */
export async function teamRankingPoints(
  rankingId: string,
  teams: { id: string; athlete1_id?: string | null; athlete2_id?: string | null }[],
): Promise<Record<string, number>> {
  const view = await computeRanking(rankingId);
  const map = new Map((view?.rows ?? []).map((r) => [r.athleteId, r.points]));
  return Object.fromEntries(teams.map((t) => [t.id, teamPoints(map, [t.athlete1_id ?? null, t.athlete2_id ?? null])]));
}
