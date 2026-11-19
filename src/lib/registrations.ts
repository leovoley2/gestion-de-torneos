import "server-only";
import { sql } from "@/lib/db";
import {
  isMinor,
  type Athlete,
  type CategoryRules,
  type RegistrationStatus,
} from "@/lib/athletes";

export interface RegCategory {
  id: string;
  name: string;
  gender: "F" | "M" | "X";
  registration_open: boolean;
  registration_deadline: Date | string | null;
  max_teams: number | null;
  min_birth_year: number | null;
  max_birth_year: number | null;
  has_format: boolean;
  tournament_id: string;
  tournament_name: string;
  tournament_city: string | null;
  start_date: string | null;
  end_date: string | null;
  published: boolean;
  accepted: number;
}

export interface Declaration {
  athlete_id: string;
  file_name: string;
  file_size: number;
  uploaded_at: Date | string;
}

export interface Registration {
  id: string;
  status: RegistrationStatus;
  admin_note: string | null;
  created_at: Date | string;
  team_id: string | null;
  category: RegCategory;
  athlete1: Athlete;
  athlete2: Athlete;
  declarations: Declaration[];
}

export const rulesOf = (c: RegCategory): CategoryRules => ({
  gender: c.gender,
  registration_open: c.registration_open,
  registration_deadline: c.registration_deadline,
  min_birth_year: c.min_birth_year,
  max_birth_year: c.max_birth_year,
  has_format: c.has_format,
});

/** Atletas menores de esta inscripción que todavía no subieron su declaración jurada. */
export function missingDeclarations(r: Registration): Athlete[] {
  return [r.athlete1, r.athlete2].filter(
    (a) => isMinor(a, r.category.start_date) && !r.declarations.some((d) => d.athlete_id === a.id),
  );
}

const CATEGORY_SELECT = sql`
  c.id, c.name, c.gender, c.registration_open, c.registration_deadline, c.max_teams,
  c.min_birth_year, c.max_birth_year, (c.format is not null) as has_format,
  t.id as tournament_id, t.name as tournament_name, t.city as tournament_city,
  t.start_date, t.end_date, t.published,
  (select count(*)::int from registrations r where r.category_id = c.id and r.status = 'accepted') as accepted`;

export async function getRegCategory(categoryId: string): Promise<RegCategory | null> {
  const [c] = await sql<RegCategory[]>`
    select ${CATEGORY_SELECT} from categories c join tournaments t on t.id = c.tournament_id where c.id = ${categoryId}`;
  return c ?? null;
}

/** Categorías de torneos publicados con inscripción abierta y en plazo. */
export async function getOpenCategories(): Promise<RegCategory[]> {
  return sql<RegCategory[]>`
    select ${CATEGORY_SELECT} from categories c join tournaments t on t.id = c.tournament_id
    where t.published and c.registration_open and c.format is null
      and (c.registration_deadline is null or c.registration_deadline > now())
    order by t.start_date nulls last, t.name, c.created_at`;
}

async function hydrate(rows: { id: string; category_id: string; athlete1_id: string; athlete2_id: string }[]) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const athleteIds = [...new Set(rows.flatMap((r) => [r.athlete1_id, r.athlete2_id]))];
  const categoryIds = [...new Set(rows.map((r) => r.category_id))];
  const [athletes, categories, declarations] = await Promise.all([
    sql<Athlete[]>`select * from athletes where id = any(${athleteIds}::uuid[])`,
    sql<RegCategory[]>`
      select ${CATEGORY_SELECT} from categories c join tournaments t on t.id = c.tournament_id where c.id = any(${categoryIds}::uuid[])`,
    sql<(Declaration & { registration_id: string })[]>`
      select registration_id, athlete_id, file_name, file_size, uploaded_at from declarations where registration_id = any(${ids}::uuid[])`,
  ]);
  const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
  const a = byId(athletes);
  const c = byId(categories);
  return rows.map((r) => ({
    ...(r as unknown as Registration),
    category: c.get(r.category_id)!,
    athlete1: a.get(r.athlete1_id)!,
    athlete2: a.get(r.athlete2_id)!,
    declarations: declarations.filter((d) => d.registration_id === r.id),
  }));
}

const REG_COLUMNS = sql`id, category_id, athlete1_id, athlete2_id, status, admin_note, created_at, team_id`;

export async function getRegistration(id: string): Promise<Registration | null> {
  const rows = await sql<{ id: string; category_id: string; athlete1_id: string; athlete2_id: string }[]>`
    select ${REG_COLUMNS} from registrations where id = ${id}`;
  return (await hydrate(rows))[0] ?? null;
}

export async function getAthleteRegistrations(athleteId: string): Promise<Registration[]> {
  const rows = await sql<{ id: string; category_id: string; athlete1_id: string; athlete2_id: string }[]>`
    select ${REG_COLUMNS} from registrations
    where athlete1_id = ${athleteId} or athlete2_id = ${athleteId}
    order by created_at desc`;
  return hydrate(rows);
}

export async function getCategoryRegistrations(categoryId: string): Promise<Registration[]> {
  const rows = await sql<{ id: string; category_id: string; athlete1_id: string; athlete2_id: string }[]>`
    select ${REG_COLUMNS} from registrations where category_id = ${categoryId}
    order by case status when 'pending_review' then 0 when 'pending_partner' then 1 when 'accepted' then 2 else 3 end,
      created_at`;
  return hydrate(rows);
}

/** Busca al compañero por correo o número de documento exactos (no permite listar atletas). */
export async function findAthleteByEmailOrDocument(query: string): Promise<Athlete | null> {
  const q = query.trim();
  if (q.length < 5) return null;
  const [byEmail] = await sql<Athlete[]>`select * from athletes where email = ${q.toLowerCase()}`;
  if (byEmail) return byEmail;
  const [byDoc] = await sql<Athlete[]>`select * from athletes where document_number = ${q.toUpperCase()}`;
  return byDoc ?? null;
}

/** ¿Alguno de los dos ya tiene una inscripción activa en la categoría? */
export async function activeRegistrationConflict(categoryId: string, athleteIds: string[], exceptId?: string) {
  const [row] = await sql<{ athlete_id: string }[]>`
    select case when athlete1_id = any(${athleteIds}::uuid[]) then athlete1_id else athlete2_id end as athlete_id
    from registrations
    where category_id = ${categoryId}
      and status in ('pending_partner', 'pending_review', 'accepted')
      and (athlete1_id = any(${athleteIds}::uuid[]) or athlete2_id = any(${athleteIds}::uuid[]))
      and id <> ${exceptId ?? "00000000-0000-0000-0000-000000000000"}
    limit 1`;
  return row?.athlete_id ?? null;
}
