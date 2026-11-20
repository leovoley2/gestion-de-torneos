"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  checkMatch,
  generateFormat,
  resolveTournament,
  resultConflicts,
  stageRules,
  validateFormat,
  type FormatDefinition,
  type MatchResult,
  type SetScore,
} from "@/lib/engine";
import { requirePermission } from "@/lib/auth";
import { eligibilityIssues, fullName, type Athlete } from "@/lib/athletes";
import { getCategoryView, isUuid } from "@/lib/data";
import { sql } from "@/lib/db";

// TODA acción de este archivo empieza con requirePermission(): sin sesión del equipo y el rol
// adecuado para ese torneo no se
// ejecuta nada. Es la única vía de escritura a la base de datos (que solo el servidor conoce).
// Un test (actions.test.ts) llama a cada acción exportada sin sesión y verifica que falle.

type Result = { ok: true; message?: string } | { ok: false; error: string };

const fail = (error: string): Result => ({ ok: false, error });
const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const optional = (v: FormDataEntryValue | null) => text(v) || null;

function refresh(categoryId?: string, tournamentId?: string) {
  if (categoryId) revalidatePath(`/admin/categorias/${categoryId}`);
  if (tournamentId) revalidatePath(`/admin/torneos/${tournamentId}`);
  revalidatePath("/", "layout");
}

function assertId(id: string) {
  if (!isUuid(id)) throw new Error("Identificador inválido");
}

// ───────── Torneos ─────────

export async function createTournament(formData: FormData) {
  await requirePermission("tournament.create");
  const name = text(formData.get("name"));
  if (!name) throw new Error("El torneo necesita un nombre");
  const [t] = await sql<{ id: string }[]>`
    insert into tournaments (name, city, start_date, end_date)
    values (${name}, ${optional(formData.get("city"))}, ${optional(formData.get("start_date"))}, ${optional(formData.get("end_date"))})
    returning id`;
  redirect(`/admin/torneos/${t.id}`);
}

export async function updateTournament(id: string, formData: FormData) {
  await requirePermission("tournament.edit", { tournamentId: id });
  assertId(id);
  const name = text(formData.get("name"));
  if (!name) throw new Error("El torneo necesita un nombre");
  await sql`
    update tournaments set name = ${name}, city = ${optional(formData.get("city"))},
      start_date = ${optional(formData.get("start_date"))}, end_date = ${optional(formData.get("end_date"))}
    where id = ${id}`;
  refresh(undefined, id);
}

export async function setPublished(id: string, published: boolean) {
  await requirePermission("tournament.edit", { tournamentId: id });
  assertId(id);
  await sql`update tournaments set published = ${published === true} where id = ${id}`;
  refresh(undefined, id);
}

export async function deleteTournament(id: string) {
  await requirePermission("tournament.edit", { tournamentId: id });
  assertId(id);
  await sql`delete from tournaments where id = ${id}`;
  revalidatePath("/", "layout");
  redirect("/admin");
}

// ───────── Categorías ─────────

export async function createCategory(tournamentId: string, formData: FormData) {
  await requirePermission("tournament.edit", { tournamentId });
  assertId(tournamentId);
  const name = text(formData.get("name"));
  const gender = text(formData.get("gender"));
  if (!name || !["F", "M", "X"].includes(gender)) throw new Error("Datos de categoría inválidos");
  const [c] = await sql<{ id: string }[]>`
    insert into categories (tournament_id, name, gender) values (${tournamentId}, ${name}, ${gender}) returning id`;
  refresh(undefined, tournamentId);
  redirect(`/admin/categorias/${c.id}`);
}

export async function deleteCategory(categoryId: string, tournamentId: string) {
  await requirePermission("tournament.edit", { categoryId });
  assertId(categoryId);
  assertId(tournamentId);
  await sql`delete from categories where id = ${categoryId}`;
  refresh(undefined, tournamentId);
  redirect(`/admin/torneos/${tournamentId}`);
}

// ───────── Duplas ─────────

/**
 * Agregar o quitar duplas cambia cuántas hay: solo se permite si todavía no hay resultados.
 * Si ya había formato, se descarta (hay que volver a armarlo con la nueva cantidad).
 */
async function teamCountChangeBlocked(categoryId: string): Promise<string | null> {
  const [c] = await sql<{ results: number }[]>`
    select (select count(*)::int from results where category_id = c.id) as results from categories c where c.id = ${categoryId}`;
  if (!c) return "Categoría no encontrada";
  return c.results > 0
    ? "Ya hay resultados cargados: para agregar o quitar duplas primero borra esos resultados o reinicia el formato. (Para corregir un jugador usa “Cambiar jugadores”.)"
    : null;
}

/** Descarta el formato (sin resultados) porque cambió la cantidad de duplas. Devuelve si había formato. */
async function discardFormatAfterTeamChange(categoryId: string): Promise<boolean> {
  const rows = await sql`
    update categories set format = null, generated = null, status = 'setup'
    where id = ${categoryId} and format is not null returning id`;
  if (rows.length) await sql`delete from schedule where category_id = ${categoryId}`;
  return rows.length > 0;
}

export interface AthleteOption {
  id: string;
  name: string;
  document: string | null;
  gender: "F" | "M" | null;
  birthdate: string | null;
  hasAccount: boolean;
}

/** Busca atletas (con o sin cuenta) por nombre o documento para armar una dupla a mano. */
export async function searchAthletes(categoryId: string, query: string): Promise<AthleteOption[]> {
  await requirePermission("tournament.edit", { categoryId });
  const q = String(query ?? "").trim().slice(0, 60);
  if (q.length < 2) return [];
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const rows = await sql<(Athlete & { has_account: boolean })[]>`
    select *, (email is not null) as has_account from athletes
    where (first_name || ' ' || last_name) ilike ${like} or document_number ilike ${like}
    order by last_name, first_name limit 8`;
  return rows.map((a) => ({
    id: a.id,
    name: fullName(a),
    document: a.document_number,
    gender: a.gender,
    birthdate: a.birthdate,
    hasAccount: a.has_account,
  }));
}

/** Crea la ficha de un jugador sin cuenta (si luego se registra, se une a su cuenta). */
export async function createAthleteRecord(categoryId: string, formData: FormData): Promise<Result & { athlete?: AthleteOption }> {
  const admin = await requirePermission("tournament.edit", { categoryId });
  const firstName = text(formData.get("first_name"));
  const lastName = text(formData.get("last_name"));
  const documentNumber = text(formData.get("document_number")).toUpperCase().replace(/\s+/g, "");
  const gender = text(formData.get("gender"));
  const birthdate = optional(formData.get("birthdate"));
  if (!firstName || !lastName) return fail("Escribe nombres y apellidos");
  if (!/^[A-Z0-9-]{5,20}$/.test(documentNumber)) return fail("Escribe un número de documento válido");
  if (gender !== "F" && gender !== "M") return fail("Elige el sexo");
  if (birthdate && !/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) return fail("Fecha de nacimiento inválida");
  try {
    const [a] = await sql<Athlete[]>`
      insert into athletes (first_name, last_name, document_number, gender, birthdate, created_by_admin)
      values (${firstName}, ${lastName}, ${documentNumber}, ${gender}, ${birthdate}, ${admin.id})
      returning *`;
    return {
      ok: true,
      athlete: { id: a.id, name: fullName(a), document: a.document_number, gender: a.gender, birthdate: a.birthdate, hasAccount: false },
    };
  } catch (e) {
    if ((e as { code?: string }).code === "23505") return fail("Ya existe un atleta con ese documento: búscalo por su documento");
    throw e;
  }
}

/** Agrega una dupla a mano con dos atletas identificados (necesario para el ranking). */
export async function addTeam(categoryId: string, formData: FormData): Promise<Result> {
  await requirePermission("tournament.edit", { categoryId });
  assertId(categoryId);
  const blocked = await teamCountChangeBlocked(categoryId);
  if (blocked) return fail(blocked);
  const ids = [text(formData.get("athlete1_id")), text(formData.get("athlete2_id"))];
  if (!ids.every(isUuid)) return fail("Elige a los dos jugadores");
  if (ids[0] === ids[1]) return fail("Elige dos jugadores distintos");
  const athletes = await sql<Athlete[]>`select * from athletes where id = any(${ids}::uuid[])`;
  const a1 = athletes.find((a) => a.id === ids[0]);
  const a2 = athletes.find((a) => a.id === ids[1]);
  if (!a1 || !a2) return fail("Jugador no encontrado");

  const [category] = await sql<{ gender: "F" | "M" | "X"; min_birth_year: number | null; max_birth_year: number | null }[]>`
    select gender, min_birth_year, max_birth_year from categories where id = ${categoryId}`;
  const issues = eligibilityIssues(
    { ...category, registration_open: true, registration_deadline: null, has_format: false },
    a1,
    a2,
  );
  if (issues.length) return fail(issues.join(". "));
  const [dup] = await sql<{ id: string }[]>`
    select id from teams where category_id = ${categoryId}
      and (athlete1_id = any(${ids}::uuid[]) or athlete2_id = any(${ids}::uuid[])) limit 1`;
  if (dup) return fail("Uno de los jugadores ya está en otra dupla de esta categoría");

  await sql`
    insert into teams (category_id, player1, player2, seed, athlete1_id, athlete2_id)
    values (${categoryId}, ${fullName(a1)}, ${fullName(a2)},
      (select coalesce(max(seed), 0) + 1 from teams where category_id = ${categoryId}), ${a1.id}, ${a2.id})`;
  const hadFormat = await discardFormatAfterTeamChange(categoryId);
  refresh(categoryId);
  return { ok: true, message: hadFormat ? "Dupla agregada. Como cambió la cantidad de duplas, vuelve a armar el formato." : undefined };
}

/** Corrige los jugadores de una dupla (p. ej. un jugador equivocado). Se puede con el torneo en curso. */
export async function replaceTeamPlayers(categoryId: string, teamId: string, formData: FormData): Promise<Result> {
  await requirePermission("tournament.edit", { categoryId });
  assertId(categoryId);
  assertId(teamId);
  const ids = [text(formData.get("athlete1_id")), text(formData.get("athlete2_id"))];
  if (!ids.every(isUuid)) return fail("Elige a los dos jugadores");
  if (ids[0] === ids[1]) return fail("Elige dos jugadores distintos");
  const [team] = await sql<{ id: string }[]>`select id from teams where id = ${teamId} and category_id = ${categoryId}`;
  if (!team) return fail("Dupla no encontrada");
  const athletes = await sql<Athlete[]>`select * from athletes where id = any(${ids}::uuid[])`;
  const a1 = athletes.find((a) => a.id === ids[0]);
  const a2 = athletes.find((a) => a.id === ids[1]);
  if (!a1 || !a2) return fail("Jugador no encontrado");
  const [category] = await sql<{ gender: "F" | "M" | "X"; min_birth_year: number | null; max_birth_year: number | null }[]>`
    select gender, min_birth_year, max_birth_year from categories where id = ${categoryId}`;
  const issues = eligibilityIssues({ ...category, registration_open: true, registration_deadline: null, has_format: false }, a1, a2);
  if (issues.length) return fail(issues.join(". "));
  const [dup] = await sql<{ id: string }[]>`
    select id from teams where category_id = ${categoryId} and id <> ${teamId}
      and (athlete1_id = any(${ids}::uuid[]) or athlete2_id = any(${ids}::uuid[])) limit 1`;
  if (dup) return fail("Uno de los jugadores ya está en otra dupla de esta categoría");
  // La dupla conserva su id, su siembra y sus resultados; solo cambian sus jugadores.
  await sql`
    update teams set player1 = ${fullName(a1)}, player2 = ${fullName(a2)}, athlete1_id = ${a1.id}, athlete2_id = ${a2.id}
    where id = ${teamId}`;
  refresh(categoryId);
  return { ok: true, message: "Jugadores corregidos" };
}

/** Reordena la siembra: `orderedIds[0]` queda como sembrado 1. */
export async function reorderTeams(categoryId: string, orderedIds: string[]): Promise<Result> {
  await requirePermission("tournament.edit", { categoryId });
  assertId(categoryId);
  if (!Array.isArray(orderedIds) || !orderedIds.every(isUuid)) return fail("Lista inválida");
  const view = await getCategoryView(categoryId, { includeDrafts: true });
  if (!view) return fail("Categoría no encontrada");
  const current = view.teams.map((t) => t.id);
  if (orderedIds.length !== current.length || !current.every((id) => orderedIds.includes(id))) return fail("Lista inválida");
  // Con formato y resultados: solo si ningún partido jugado cambia de duplas.
  if (view.category.format && view.category.generated) {
    const reseeded = view.teamRefs.map((t) => ({ ...t, seed: orderedIds.indexOf(t.id) + 1 }));
    const setup = { format: view.category.format, gen: view.category.generated };
    const issues = resultConflicts({ ...setup, teams: view.teamRefs }, { ...setup, teams: reseeded }, view.results);
    if (issues.length) return fail(`No se puede cambiar la siembra, cambiaría partidos ya jugados:\n• ${issues.join("\n• ")}`);
  }
  await sql.begin(async (tx) => {
    // La restricción única de siembra es diferida: se valida al confirmar la transacción.
    for (const [i, id] of orderedIds.entries()) {
      await tx`update teams set seed = ${i + 1} where id = ${id} and category_id = ${categoryId}`;
    }
  });
  refresh(categoryId);
  return { ok: true };
}

export async function deleteTeam(categoryId: string, teamId: string): Promise<Result> {
  await requirePermission("tournament.edit", { categoryId });
  assertId(categoryId);
  assertId(teamId);
  const blocked = await teamCountChangeBlocked(categoryId);
  if (blocked) return fail(blocked);
  await sql.begin(async (tx) => {
    // Si la dupla vino de una inscripción, la inscripción queda como retirada por la organización.
    await tx`
      update registrations set status = 'withdrawn', admin_note = 'Retirada por la organización'
      where team_id = ${teamId} and status = 'accepted'`;
    await tx`delete from teams where id = ${teamId} and category_id = ${categoryId}`;
    await tx`
      update teams t set seed = r.n
      from (select id, row_number() over (order by seed) as n from teams where category_id = ${categoryId}) r
      where t.id = r.id`;
  });
  const hadFormat = await discardFormatAfterTeamChange(categoryId);
  refresh(categoryId);
  return { ok: true, message: hadFormat ? "Dupla quitada. Como cambió la cantidad de duplas, vuelve a armar el formato." : undefined };
}

// ───────── Formato ─────────

export async function saveFormat(categoryId: string, formatJson: string): Promise<Result> {
  await requirePermission("tournament.edit", { categoryId });
  assertId(categoryId);
  const view = await getCategoryView(categoryId, { includeDrafts: true });
  if (!view) return fail("Categoría no encontrada");
  let format: FormatDefinition;
  let generated;
  try {
    format = JSON.parse(formatJson);
    generated = generateFormat(format);
  } catch (e) {
    return fail(`Formato inválido: ${(e as Error).message}`);
  }
  const problems = validateFormat(format, view.teams.length);
  if (problems.length > 0) return fail(problems.join(" "));

  // Editar con resultados cargados: se conservan si siguen valiendo con el nuevo formato.
  const { format: oldFormat, generated: oldGen } = view.category;
  if (oldFormat && oldGen) {
    const conflicts = resultConflicts(
      { format: oldFormat, gen: oldGen, teams: view.teamRefs },
      { format, gen: generated, teams: view.teamRefs },
      view.results,
    );
    if (conflicts.length) {
      return fail(
        `El cambio afecta partidos que ya tienen resultado:\n• ${conflicts.join("\n• ")}\nCorrige o borra esos resultados primero.`,
      );
    }
  }
  const keys = generated.matches.map((m) => m.key);
  const after = resolveTournament(format, generated, view.teamRefs, view.results);
  const done = after.matches.every((m) => m.status === "finished" || m.status === "cancelled");
  await sql.begin(async (tx) => {
    await tx`
      update categories set format = ${tx.json(JSON.parse(JSON.stringify(format)))},
        generated = ${tx.json(JSON.parse(JSON.stringify(generated)))}, status = ${done ? "finished" : "in_progress"}
      where id = ${categoryId}`;
    // Programación y resultados de partidos que ya no existen se descartan; el resto se conserva.
    await tx`delete from schedule where category_id = ${categoryId} and not (match_key = any(${keys}::text[]))`;
    await tx`delete from results where category_id = ${categoryId} and not (match_key = any(${keys}::text[]))`;
  });
  refresh(categoryId);
  const kept = Object.keys(view.results).filter((k) => keys.includes(k)).length;
  return { ok: true, message: kept ? `Formato actualizado: se conservaron ${kept} resultados` : "Formato guardado" };
}

/** Borra formato, resultados y programación (las duplas se mantienen). */
export async function resetFormat(categoryId: string): Promise<Result> {
  await requirePermission("tournament.edit", { categoryId });
  assertId(categoryId);
  await sql.begin(async (tx) => {
    await tx`delete from results where category_id = ${categoryId}`;
    await tx`delete from schedule where category_id = ${categoryId}`;
    await tx`update categories set format = null, generated = null, status = 'setup' where id = ${categoryId}`;
  });
  refresh(categoryId);
  return { ok: true };
}

// ───────── Resultados y programación ─────────

/**
 * Guarda (o borra, con `result = null`) el resultado de un partido.
 * Se rechaza si el cambio alteraría los equipos de partidos posteriores que ya tienen resultado.
 */
export async function saveResult(
  categoryId: string,
  matchKey: string,
  result: { sets: SetScore[]; walkoverWinner?: string } | null,
): Promise<Result> {
  const admin = await requirePermission("results.edit", { categoryId });
  assertId(categoryId);
  const view = await getCategoryView(categoryId, { includeDrafts: true });
  if (!view?.category.format || !view.category.generated || !view.state) return fail("La categoría no tiene formato");
  const { format, generated } = view.category;
  const match = view.state.matches.find((m) => m.key === matchKey);
  if (!match) return fail("Partido no encontrado");
  if (!match.teamA || !match.teamB) return fail("El partido todavía no tiene sus dos duplas definidas");
  if (match.status === "cancelled") return fail("Este partido no se juega");

  if (result) {
    if (result.walkoverWinner) {
      if (![match.teamA, match.teamB].includes(result.walkoverWinner)) return fail("W.O. inválido");
      result = { sets: [], walkoverWinner: result.walkoverWinner };
    } else {
      const sets = Array.isArray(result.sets) ? result.sets : [];
      result = { sets: sets.map((s) => ({ a: Number(s?.a), b: Number(s?.b) })) };
      const stage = format.stages.find((s) => s.key === match.stageKey)!;
      const check = checkMatch(result.sets, stageRules(format, stage).match);
      if (!check.ok) return fail(check.errors.join(". "));
    }
  }

  const next: Record<string, MatchResult> = { ...view.results };
  if (result) next[matchKey] = result;
  else delete next[matchKey];
  const after = resolveTournament(format, generated, view.teamRefs, next);
  const before = new Map(view.state.matches.map((m) => [m.key, m]));
  const broken = after.matches.filter((m) => {
    if (m.key === matchKey || !view.results[m.key]) return false;
    const b = before.get(m.key)!;
    return b.teamA !== m.teamA || b.teamB !== m.teamB;
  });
  if (broken.length > 0) {
    return fail(
      `Este cambio altera partidos que ya tienen resultado (${broken
        .map((m) => `P${m.number}`)
        .join(", ")}). Borra primero esos resultados.`,
    );
  }

  // La categoría termina cuando no queda nada por jugar.
  const done = after.matches.every((m) => m.status === "finished" || m.status === "cancelled");
  await sql.begin(async (tx) => {
    if (result) {
      await tx`
        insert into results (category_id, match_key, sets, walkover_winner, updated_by)
        values (${categoryId}, ${matchKey}, ${tx.json(result.sets.map((s) => ({ a: s.a, b: s.b })))}, ${result.walkoverWinner ?? null}, ${admin.id})
        on conflict (category_id, match_key) do update
          set sets = excluded.sets, walkover_winner = excluded.walkover_winner,
              updated_by = excluded.updated_by, updated_at = now()`;
    } else {
      await tx`delete from results where category_id = ${categoryId} and match_key = ${matchKey}`;
    }
    await tx`update categories set status = ${done ? "finished" : "in_progress"} where id = ${categoryId}`;
  });
  refresh(categoryId);
  return { ok: true };
}

export async function saveSchedule(
  categoryId: string,
  matchKey: string,
  court: string,
  scheduledAt: string | null,
): Promise<Result> {
  await requirePermission("results.edit", { categoryId });
  assertId(categoryId);
  const when = scheduledAt ? new Date(scheduledAt) : null;
  if (when && Number.isNaN(when.getTime())) return fail("Fecha inválida");
  await sql`
    insert into schedule (category_id, match_key, court, scheduled_at)
    values (${categoryId}, ${matchKey}, ${String(court ?? "").trim() || null}, ${when})
    on conflict (category_id, match_key) do update
      set court = excluded.court, scheduled_at = excluded.scheduled_at, updated_at = now()`;
  refresh(categoryId);
  return { ok: true };
}
