// Datos del panel: resumen de torneos y categorías, y la lista de pendientes según el rol.
import { sql } from "./db";
import { can, visibleTournaments, type RoleGrant } from "./permissions";
import { tournamentPhase, type Phase } from "./format";

export interface CategorySummary {
  id: string;
  tournament_id: string;
  tournament_name: string;
  name: string;
  gender: "F" | "M" | "X";
  status: "setup" | "in_progress" | "finished";
  registration_open: boolean;
  teams: number;
  has_format: boolean;
  matches: number;
  results: number;
  pending_reviews: number;
  today_pending: number;
}

export interface TournamentSummary {
  id: string;
  name: string;
  city: string | null;
  start_date: string | null;
  end_date: string | null;
  published: boolean;
  phase: Phase;
  categories: number;
  teams: number;
  matches: number;
  results: number;
  pending_reviews: number;
}

export interface Task {
  kind: "review" | "today" | "format" | "publish" | "email";
  urgent: boolean;
  title: string;
  detail: string;
  href: string;
}

/** Avance de una categoría (0 a 1): terminada = 1; si no, resultados sobre partidos. */
export function progressOf(
  c: Pick<CategorySummary, "status" | "matches" | "results">,
): number {
  if (c.status === "finished") return 1;
  return c.matches > 0 ? Math.min(1, c.results / c.matches) : 0;
}

/** Los torneos terminados hace más de esto pasan al archivo y salen del inicio del panel. */
export const ARCHIVE_AFTER_DAYS = 90;

/** Fecha (AAAA-MM-DD, hora de Lima) desde la que un torneo sigue en el inicio del panel. */
export function archiveCutoff(now = new Date()): string {
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ARCHIVE_AFTER_DAYS);
  return d.toISOString().slice(0, 10);
}

/** Categorías de los torneos visibles (o solo de los indicados), con conteos para el panel. */
export async function getCategorySummaries(
  grants: RoleGrant[],
  tournamentIds?: string[],
): Promise<CategorySummary[]> {
  const visible = visibleTournaments(grants);
  if (tournamentIds && tournamentIds.length === 0) return [];
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Lima",
  });
  return sql<CategorySummary[]>`
    select c.id, c.tournament_id, t.name as tournament_name, c.name, c.gender, c.status, c.registration_open,
      (select count(*)::int from teams where category_id = c.id) as teams,
      (c.generated is not null) as has_format,
      coalesce(jsonb_array_length(c.generated -> 'matches'), 0)::int as matches,
      (select count(*)::int from results where category_id = c.id) as results,
      (select count(*)::int from registrations where category_id = c.id and status = 'pending_review') as pending_reviews,
      (select count(*)::int from schedule s
        where s.category_id = c.id
          and (s.scheduled_at at time zone 'America/Lima')::date = ${today}::date
          and not exists (select 1 from results r where r.category_id = c.id and r.match_key = s.match_key)
      ) as today_pending
    from categories c join tournaments t on t.id = c.tournament_id
    where (${visible === null} or c.tournament_id = any(${visible ?? []}::uuid[]))
      and (${!tournamentIds} or c.tournament_id = any(${tournamentIds ?? []}::uuid[]))
    order by t.start_date desc nulls first, c.created_at`;
}

export type TournamentRow = Pick<
  TournamentSummary,
  "id" | "name" | "city" | "start_date" | "end_date" | "published"
>;

/** Suma los conteos de sus categorías a cada torneo y calcula en qué momento está. */
export function summarize(
  rows: TournamentRow[],
  categories: CategorySummary[],
  now = new Date(),
): TournamentSummary[] {
  return rows.map((t) => {
    const cats = categories.filter((c) => c.tournament_id === t.id);
    const sum = (k: "teams" | "matches" | "results" | "pending_reviews") =>
      cats.reduce((n, c) => n + c[k], 0);
    let phase = tournamentPhase(t.start_date, t.end_date, now);
    // Sin fechas, el estado sale de sus categorías.
    if (phase === "unknown" && cats.length > 0) {
      phase = cats.every((c) => c.status === "finished")
        ? "past"
        : cats.some((c) => c.status !== "setup")
          ? "live"
          : "upcoming";
    }
    return {
      ...t,
      phase,
      categories: cats.length,
      teams: sum("teams"),
      matches: sum("matches"),
      results: sum("results"),
      pending_reviews: sum("pending_reviews"),
    };
  });
}

/**
 * Inicio del panel: torneos sin fechas, por venir, en curso o terminados hace menos de
 * ARCHIVE_AFTER_DAYS días. Los más antiguos quedan en el archivo, así el inicio no crece con los años.
 */
export async function getDashboard(grants: RoleGrant[]) {
  const visible = visibleTournaments(grants);
  const cutoff = archiveCutoff();
  const rows = await sql<TournamentRow[]>`
    select id, name, city, start_date, end_date, published from tournaments
    where (${visible === null} or id = any(${visible ?? []}::uuid[]))
      and (coalesce(end_date, start_date) is null or coalesce(end_date, start_date) >= ${cutoff}::date)
    order by start_date desc nulls first, created_at desc`;
  const [{ n: archived }] = await sql<{ n: number }[]>`
    select count(*)::int as n from tournaments
    where (${visible === null} or id = any(${visible ?? []}::uuid[]))
      and coalesce(end_date, start_date) < ${cutoff}::date`;
  const categories = await getCategorySummaries(
    grants,
    rows.map((r) => r.id),
  );
  return { tournaments: summarize(rows, categories), categories, archived };
}

export const ARCHIVE_PAGE_SIZE = 20;

/** Archivo: torneos terminados hace más de ARCHIVE_AFTER_DAYS días, por año, con búsqueda y páginas. */
export async function getArchive(
  grants: RoleGrant[],
  opts: { q?: string; year?: number; page?: number },
) {
  const visible = visibleTournaments(grants);
  const cutoff = archiveCutoff();
  const q = (opts.q ?? "").trim();
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const year = opts.year ?? null;
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const rows = await sql<TournamentRow[]>`
    select id, name, city, start_date, end_date, published from tournaments
    where (${visible === null} or id = any(${visible ?? []}::uuid[]))
      and coalesce(end_date, start_date) < ${cutoff}::date
      and (${!q} or name ilike ${like} or city ilike ${like})
      and (${year}::int is null or extract(year from coalesce(start_date, end_date)) = ${year}::int)
    order by coalesce(start_date, end_date) desc, created_at desc
    limit ${ARCHIVE_PAGE_SIZE + 1} offset ${(page - 1) * ARCHIVE_PAGE_SIZE}`;
  const years = await sql<{ y: number }[]>`
    select distinct extract(year from coalesce(start_date, end_date))::int as y from tournaments
    where (${visible === null} or id = any(${visible ?? []}::uuid[]))
      and coalesce(end_date, start_date) < ${cutoff}::date
    order by y desc`;
  const shown = rows.slice(0, ARCHIVE_PAGE_SIZE);
  const categories = await getCategorySummaries(
    grants,
    shown.map((r) => r.id),
  );
  return {
    tournaments: summarize(shown, categories),
    years: years.map((r) => r.y),
    page,
    hasMore: rows.length > ARCHIVE_PAGE_SIZE,
  };
}

const daysUntil = (date: string, now: Date) => {
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Lima" });
  return Math.round(
    (Date.parse(date.slice(0, 10)) - Date.parse(today)) / 86_400_000,
  );
};

/**
 * Lo que necesita atención, filtrado por lo que el rol puede hacer en cada torneo.
 * Lo urgente (inscripciones por revisar, partidos de hoy sin resultado) va primero.
 */
export function buildTasks(
  grants: RoleGrant[],
  tournaments: TournamentSummary[],
  categories: CategorySummary[],
  now = new Date(),
  emailEnabled = true,
): Task[] {
  const tasks: Task[] = [];
  if (!emailEnabled && can(grants, "staff.manage")) {
    tasks.push({
      kind: "email",
      urgent: true,
      title: "Los correos no se están enviando",
      detail: "Los atletas no reciben confirmaciones ni recuperación de contraseña",
      href: "/admin/correos",
    });
  }
  const where = (c: CategorySummary) => `${c.tournament_name} · ${c.name}`;
  const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  const finishedTournament = new Set(
    tournaments.filter((t) => t.phase === "past").map((t) => t.id),
  );

  for (const c of categories) {
    const href = `/admin/categorias/${c.id}`;
    if (
      c.pending_reviews > 0 &&
      can(grants, "registrations.review", c.tournament_id)
    ) {
      tasks.push({
        kind: "review",
        urgent: true,
        title: `${plural(c.pending_reviews, "inscripción", "inscripciones")} por revisar`,
        detail: where(c),
        href: `${href}#inscripciones`,
      });
    }
    if (c.today_pending > 0 && can(grants, "results.edit", c.tournament_id)) {
      tasks.push({
        kind: "today",
        urgent: true,
        title: `${plural(c.today_pending, "partido", "partidos")} de hoy sin resultado`,
        detail: where(c),
        href,
      });
    }
    if (
      c.teams >= 2 &&
      !c.has_format &&
      !finishedTournament.has(c.tournament_id) &&
      can(grants, "tournament.edit", c.tournament_id)
    ) {
      tasks.push({
        kind: "format",
        urgent: false,
        title: "Falta armar el formato",
        detail: `${where(c)} · ${c.teams} duplas`,
        href,
      });
    }
  }

  for (const t of tournaments) {
    if (t.published || !t.start_date || !can(grants, "tournament.edit", t.id))
      continue;
    const days = daysUntil(t.start_date, now);
    if (t.phase === "past" || days > 14) continue;
    tasks.push({
      kind: "publish",
      urgent: days <= 2,
      title: "Torneo sin publicar",
      detail: `${t.name} · ${days < 0 ? "ya empezó" : days === 0 ? "empieza hoy" : days === 1 ? "empieza mañana" : `empieza en ${days} días`}`,
      href: `/admin/torneos/${t.id}`,
    });
  }

  return tasks.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}
