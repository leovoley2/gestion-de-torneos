"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  checkMatch,
  generateFormat,
  resolveTournament,
  stageRules,
  type FormatDefinition,
  type MatchResult,
  type SetScore,
} from "@/lib/engine";
import { requireAdmin } from "@/lib/auth";
import { getCategoryView, isUuid } from "@/lib/data";
import { sql } from "@/lib/db";

// TODA acción de este archivo empieza con requireAdmin(): sin sesión de administrador no se
// ejecuta nada. Es la única vía de escritura a la base de datos (que solo el servidor conoce).
// Un test (actions.test.ts) llama a cada acción exportada sin sesión y verifica que falle.

type Result = { ok: true } | { ok: false; error: string };

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
  await requireAdmin();
  const name = text(formData.get("name"));
  if (!name) throw new Error("El torneo necesita un nombre");
  const [t] = await sql<{ id: string }[]>`
    insert into tournaments (name, city, start_date, end_date)
    values (${name}, ${optional(formData.get("city"))}, ${optional(formData.get("start_date"))}, ${optional(formData.get("end_date"))})
    returning id`;
  redirect(`/admin/torneos/${t.id}`);
}

export async function updateTournament(id: string, formData: FormData) {
  await requireAdmin();
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
  await requireAdmin();
  assertId(id);
  await sql`update tournaments set published = ${published === true} where id = ${id}`;
  refresh(undefined, id);
}

export async function deleteTournament(id: string) {
  await requireAdmin();
  assertId(id);
  await sql`delete from tournaments where id = ${id}`;
  revalidatePath("/", "layout");
  redirect("/admin");
}

// ───────── Categorías ─────────

export async function createCategory(tournamentId: string, formData: FormData) {
  await requireAdmin();
  assertId(tournamentId);
  const name = text(formData.get("name"));
  const gender = text(formData.get("gender"));
  if (!name || !["F", "M", "X"].includes(gender)) throw new Error("Datos de categoría inválidos");
  const [c] = await sql<{ id: string }[]>`
    insert into categories (tournament_id, name, gender) values (${tournamentId}, ${name}, ${gender}) returning id`;
  redirect(`/admin/categorias/${c.id}`);
}

export async function deleteCategory(categoryId: string, tournamentId: string) {
  await requireAdmin();
  assertId(categoryId);
  assertId(tournamentId);
  await sql`delete from categories where id = ${categoryId}`;
  refresh(undefined, tournamentId);
  redirect(`/admin/torneos/${tournamentId}`);
}

// ───────── Duplas ─────────

async function formatLocked(categoryId: string): Promise<string | null> {
  const [c] = await sql<{ locked: boolean }[]>`select format is not null as locked from categories where id = ${categoryId}`;
  if (!c) return "Categoría no encontrada";
  return c.locked ? "El formato ya está generado. Para cambiar duplas, reinicia el formato." : null;
}

export async function addTeam(categoryId: string, formData: FormData): Promise<Result> {
  await requireAdmin();
  assertId(categoryId);
  const blocked = await formatLocked(categoryId);
  if (blocked) return fail(blocked);
  const player1 = text(formData.get("player1"));
  const player2 = text(formData.get("player2"));
  if (!player1 || !player2) return fail("Escribe los dos jugadores");
  await sql`
    insert into teams (category_id, player1, player2, seed)
    values (${categoryId}, ${player1}, ${player2},
      (select coalesce(max(seed), 0) + 1 from teams where category_id = ${categoryId}))`;
  refresh(categoryId);
  return { ok: true };
}

/** Reordena la siembra: `orderedIds[0]` queda como sembrado 1. */
export async function reorderTeams(categoryId: string, orderedIds: string[]): Promise<Result> {
  await requireAdmin();
  assertId(categoryId);
  if (!Array.isArray(orderedIds) || !orderedIds.every(isUuid)) return fail("Lista inválida");
  const blocked = await formatLocked(categoryId);
  if (blocked) return fail(blocked);
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
  await requireAdmin();
  assertId(categoryId);
  assertId(teamId);
  const blocked = await formatLocked(categoryId);
  if (blocked) return fail(blocked);
  await sql.begin(async (tx) => {
    await tx`delete from teams where id = ${teamId} and category_id = ${categoryId}`;
    await tx`
      update teams t set seed = r.n
      from (select id, row_number() over (order by seed) as n from teams where category_id = ${categoryId}) r
      where t.id = r.id`;
  });
  refresh(categoryId);
  return { ok: true };
}

// ───────── Formato ─────────

export async function saveFormat(categoryId: string, formatJson: string): Promise<Result> {
  await requireAdmin();
  assertId(categoryId);
  const view = await getCategoryView(categoryId, { includeDrafts: true });
  if (!view) return fail("Categoría no encontrada");
  if (Object.keys(view.results).length > 0) {
    return fail("Ya hay resultados cargados. Reinicia el formato para cambiarlo.");
  }
  let format: FormatDefinition;
  let generated;
  try {
    format = JSON.parse(formatJson);
    generated = generateFormat(format);
  } catch (e) {
    return fail(`Formato inválido: ${(e as Error).message}`);
  }
  if (generated.matches.length === 0) return fail("El formato no genera partidos");
  await sql.begin(async (tx) => {
    await tx`
      update categories set format = ${tx.json(JSON.parse(JSON.stringify(format)))},
        generated = ${tx.json(JSON.parse(JSON.stringify(generated)))}, status = 'in_progress'
      where id = ${categoryId}`;
    await tx`delete from schedule where category_id = ${categoryId}`;
  });
  refresh(categoryId);
  return { ok: true };
}

/** Borra formato, resultados y programación (las duplas se mantienen). */
export async function resetFormat(categoryId: string): Promise<Result> {
  await requireAdmin();
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
  const admin = await requireAdmin();
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
  await requireAdmin();
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
