"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { tableIssues, type PointRow } from "@/lib/ranking-calc";

// Rankings, tablas de puntos y posiciones finales. TODA acción empieza con requirePermission():
// rankings y tablas exigen "ranking.manage" (administrador general); asignar el ranking de una
// categoría y corregir posiciones finales exigen "tournament.edit" de ese torneo.
// (actions.test.ts y roles.test.ts recorren este archivo.)

type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refreshAll() {
  revalidatePath("/", "layout"); // ranking público, páginas de torneo y panel
}

// ───────── Rankings ─────────

export async function createRanking(fd: FormData): Promise<Result> {
  await requirePermission("ranking.manage");
  const name = String(fd.get("name") ?? "").trim();
  const gender = String(fd.get("gender") ?? "");
  const season = Number(fd.get("season"));
  if (!name) return fail("Escribe el nombre del ranking");
  if (!["F", "M", "X"].includes(gender)) return fail("Elige la rama");
  if (!Number.isInteger(season) || season < 2000 || season > 2100) return fail("Temporada inválida");
  await sql`insert into rankings (name, gender, season) values (${name}, ${gender}, ${season})`;
  refreshAll();
  return { ok: true, message: "Ranking creado" };
}

export async function setRankingPublished(rankingId: string, published: boolean): Promise<Result> {
  await requirePermission("ranking.manage");
  if (!UUID.test(rankingId)) return fail("Ranking inválido");
  await sql`update rankings set published = ${published === true} where id = ${rankingId}`;
  refreshAll();
  return { ok: true, message: published ? "Ranking visible al público" : "Ranking oculto" };
}

export async function deleteRanking(rankingId: string): Promise<Result> {
  await requirePermission("ranking.manage");
  if (!UUID.test(rankingId)) return fail("Ranking inválido");
  await sql`delete from rankings where id = ${rankingId}`; // las categorías quedan sin ranking
  refreshAll();
  return { ok: true, message: "Ranking eliminado" };
}

// ───────── Tablas de puntos ─────────

export async function savePointTable(tableId: string | null, fd: FormData): Promise<Result> {
  await requirePermission("ranking.manage");
  if (tableId !== null && !UUID.test(tableId)) return fail("Tabla inválida");
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return fail("Escribe el nombre de la tabla");
  let rows: PointRow[];
  try {
    rows = (JSON.parse(String(fd.get("rows") ?? "[]")) as PointRow[]).map((r) => ({
      from: Number(r.from),
      to: Number(r.to),
      points: Number(r.points),
    }));
  } catch {
    return fail("Tabla inválida");
  }
  const issues = tableIssues(rows);
  if (issues.length) return fail(issues.join(". "));
  rows.sort((a, b) => a.from - b.from);
  if (tableId) {
    await sql`update point_tables set name = ${name}, rows = ${sql.json(rows as unknown as Parameters<typeof sql.json>[0])} where id = ${tableId}`;
  } else {
    await sql`insert into point_tables (name, rows) values (${name}, ${sql.json(rows as unknown as Parameters<typeof sql.json>[0])})`;
  }
  refreshAll();
  return { ok: true, message: "Tabla de puntos guardada" };
}

export async function deletePointTable(tableId: string): Promise<Result> {
  await requirePermission("ranking.manage");
  if (!UUID.test(tableId)) return fail("Tabla inválida");
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from categories where point_table_id = ${tableId}`;
  if (n > 0) return fail(`La usan ${n} categorías: cámbiales la tabla antes de borrarla`);
  await sql`delete from point_tables where id = ${tableId}`;
  refreshAll();
  return { ok: true, message: "Tabla eliminada" };
}

// ───────── Categoría: a qué ranking suma y posiciones finales ─────────

export async function setCategoryRanking(categoryId: string, fd: FormData): Promise<Result> {
  await requirePermission("tournament.edit", { categoryId });
  const rankingId = String(fd.get("ranking_id") ?? "") || null;
  const tableId = String(fd.get("point_table_id") ?? "") || null;
  if ((rankingId && !UUID.test(rankingId)) || (tableId && !UUID.test(tableId))) return fail("Selección inválida");
  if (rankingId && !tableId) return fail("Elige la tabla de puntos");
  if (rankingId) {
    const [r] = await sql<{ gender: string }[]>`select gender from rankings where id = ${rankingId}`;
    const [c] = await sql<{ gender: string }[]>`select gender from categories where id = ${categoryId}`;
    if (!r || !c) return fail("No encontrado");
    if (r.gender !== c.gender) return fail("La rama del ranking no coincide con la de la categoría");
  }
  await sql`update categories set ranking_id = ${rankingId}, point_table_id = ${tableId} where id = ${categoryId}`;
  revalidatePath(`/admin/categorias/${categoryId}`);
  refreshAll();
  return { ok: true, message: rankingId ? "La categoría suma al ranking" : "La categoría ya no suma a ningún ranking" };
}

/** Corrige a mano la posición final de una dupla (o vuelve a la calculada con `position` vacío). */
export async function setFinalPosition(categoryId: string, teamId: string, position: number | null): Promise<Result> {
  await requirePermission("tournament.edit", { categoryId });
  if (!UUID.test(teamId)) return fail("Dupla inválida");
  if (position === null) {
    await sql`delete from final_positions where category_id = ${categoryId} and team_id = ${teamId}`;
  } else {
    if (!Number.isInteger(position) || position < 1 || position > 999) return fail("Posición inválida");
    const [t] = await sql<{ id: string }[]>`select id from teams where id = ${teamId} and category_id = ${categoryId}`;
    if (!t) return fail("La dupla no es de esta categoría");
    await sql`
      insert into final_positions (category_id, team_id, position) values (${categoryId}, ${teamId}, ${position})
      on conflict (category_id, team_id) do update set position = excluded.position`;
  }
  revalidatePath(`/admin/categorias/${categoryId}`);
  refreshAll();
  return { ok: true, message: position === null ? "Se usa la posición calculada" : "Posición corregida" };
}
