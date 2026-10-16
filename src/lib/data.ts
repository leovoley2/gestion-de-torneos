import "server-only";
import {
  resolveTournament,
  type FormatDefinition,
  type GeneratedFormat,
  type MatchResult,
  type TeamRef,
  type TournamentState,
} from "@/lib/engine";
import { sql } from "@/lib/db";

export interface Tournament {
  id: string;
  name: string;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  published: boolean;
}

export interface Category {
  id: string;
  tournament_id: string;
  name: string;
  gender: "F" | "M" | "X";
  status: "setup" | "in_progress" | "finished";
  format: FormatDefinition | null;
  generated: GeneratedFormat | null;
}

export interface Team {
  id: string;
  category_id: string;
  player1: string;
  player2: string;
  seed: number;
}

export interface ScheduleRow {
  match_key: string;
  court: string | null;
  scheduled_at: string | null;
}

export interface CategoryView {
  category: Category;
  tournament: Tournament;
  teams: Team[];
  teamRefs: TeamRef[];
  results: Record<string, MatchResult>;
  schedule: Record<string, ScheduleRow>;
  state: TournamentState | null;
}

export const GENDER_LABEL = { F: "Femenino", M: "Masculino", X: "Mixto" } as const;
export const teamLabel = (t: Pick<Team, "player1" | "player2">) => `${t.player1} / ${t.player2}`;

/**
 * Todo lo que hace falta para mostrar una categoría.
 * Las páginas públicas usan `includeDrafts: false`: un torneo sin publicar devuelve null.
 */
export async function getCategoryView(
  categoryId: string,
  { includeDrafts }: { includeDrafts: boolean },
): Promise<CategoryView | null> {
  if (!isUuid(categoryId)) return null;
  const [category] = await sql<Category[]>`select * from categories where id = ${categoryId}`;
  if (!category) return null;
  const [tournament] = await sql<Tournament[]>`select * from tournaments where id = ${category.tournament_id}`;
  if (!tournament || (!tournament.published && !includeDrafts)) return null;

  const [teams, results, schedule] = await Promise.all([
    sql<Team[]>`select id, category_id, player1, player2, seed from teams where category_id = ${categoryId} order by seed`,
    sql<{ match_key: string; sets: MatchResult["sets"]; walkover_winner: string | null }[]>`
      select match_key, sets, walkover_winner from results where category_id = ${categoryId}`,
    sql<ScheduleRow[]>`select match_key, court, scheduled_at from schedule where category_id = ${categoryId}`,
  ]);

  const teamRefs: TeamRef[] = teams.map((t) => ({ id: t.id, name: teamLabel(t), seed: t.seed }));
  const resultMap: Record<string, MatchResult> = {};
  for (const r of results) {
    resultMap[r.match_key] = { sets: r.sets ?? [], walkoverWinner: r.walkover_winner ?? undefined };
  }
  const scheduleMap: Record<string, ScheduleRow> = {};
  for (const s of schedule) scheduleMap[s.match_key] = { ...s, scheduled_at: toIso(s.scheduled_at) };

  const state =
    category.format && category.generated
      ? resolveTournament(category.format, category.generated, teamRefs, resultMap)
      : null;

  return { category, tournament, teams: [...teams], teamRefs, results: resultMap, schedule: scheduleMap, state };
}

/**
 * Huella de la última modificación de una categoría publicada (resultados, programación o formato).
 * La vista pública la consulta cada pocos segundos y solo recarga si cambió.
 */
export async function getCategoryVersion(categoryId: string): Promise<string | null> {
  if (!isUuid(categoryId)) return null;
  const [row] = await sql<{ v: string }[]>`
    select concat_ws('|',
      (select max(updated_at)::text || ':' || count(*) from results where category_id = c.id),
      (select max(updated_at)::text || ':' || count(*) from schedule where category_id = c.id),
      md5(coalesce(c.generated::text, '')),
      (select count(*) from teams where category_id = c.id)
    ) as v
    from categories c join tournaments t on t.id = c.tournament_id
    where c.id = ${categoryId} and t.published`;
  return row?.v ?? null;
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const toIso = (d: Date | string | null) => (d == null ? null : new Date(d).toISOString());
