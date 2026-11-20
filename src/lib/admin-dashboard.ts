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
  kind: "review" | "today" | "format" | "publish";
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

/** Categorías de los torneos visibles, con conteos para el panel. */
export async function getCategorySummaries(
  grants: RoleGrant[],
  tournamentId?: string,
): Promise<CategorySummary[]> {
  const visible = visibleTournaments(grants);
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
      and (${tournamentId ?? null}::uuid is null or c.tournament_id = ${tournamentId ?? null}::uuid)
    order by t.start_date desc nulls first, c.created_at`;
}

/** Torneos visibles con totales de sus categorías. */
export async function getTournamentSummaries(
  grants: RoleGrant[],
  categories: CategorySummary[],
): Promise<TournamentSummary[]> {
  const visible = visibleTournaments(grants);
  const rows = await sql<
    Omit<
      TournamentSummary,
      | "phase"
      | "categories"
      | "teams"
      | "matches"
      | "results"
      | "pending_reviews"
    >[]
  >`
    select id, name, city, start_date, end_date, published from tournaments
    where ${visible === null} or id = any(${visible ?? []}::uuid[])
    order by start_date desc nulls first, created_at desc`;
  return rows.map((t) => {
    const cats = categories.filter((c) => c.tournament_id === t.id);
    const sum = (k: "teams" | "matches" | "results" | "pending_reviews") =>
      cats.reduce((n, c) => n + c[k], 0);
    let phase = tournamentPhase(t.start_date, t.end_date);
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
): Task[] {
  const tasks: Task[] = [];
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
