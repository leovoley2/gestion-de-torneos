"use server";

import { revalidatePath } from "next/cache";
import { createResetLinkForAdmin } from "@/lib/athlete-auth";
import { eligibilityIssues, fullName, profileIssues } from "@/lib/athletes";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/data";
import { sql } from "@/lib/db";
import { appUrl, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import { activeRegistrationConflict, getRegCategory, getRegistration, missingDeclarations, rulesOf } from "@/lib/registrations";

// Inscripciones y atletas desde el panel. TODA acción empieza con requireAdmin()
// (admin/actions.test.ts recorre también este archivo).

type Result = { ok: true; message?: string; link?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

function assertId(id: string) {
  if (!isUuid(id)) throw new Error("Identificador inválido");
}

function refreshCategory(categoryId: string) {
  revalidatePath(`/admin/categorias/${categoryId}`);
  revalidatePath("/", "layout");
}

// ───────── Ajustes de inscripción de la categoría ─────────

export async function updateRegistrationSettings(categoryId: string, fd: FormData): Promise<Result> {
  await requireAdmin();
  assertId(categoryId);
  const int = (k: string) => {
    const v = String(fd.get(k) ?? "").trim();
    return v === "" ? null : Number(v);
  };
  const maxTeams = int("max_teams");
  const minYear = int("min_birth_year");
  const maxYear = int("max_birth_year");
  if (maxTeams !== null && (!Number.isInteger(maxTeams) || maxTeams < 2)) return fail("El cupo debe ser de al menos 2 duplas");
  for (const y of [minYear, maxYear]) {
    if (y !== null && (!Number.isInteger(y) || y < 1900 || y > 2100)) return fail("Año de nacimiento inválido");
  }
  if (minYear && maxYear && minYear > maxYear) return fail("El año mínimo no puede ser mayor que el máximo");
  const deadlineRaw = String(fd.get("registration_deadline") ?? "").trim();
  const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
  if (deadline && Number.isNaN(deadline.getTime())) return fail("Fecha límite inválida");

  await sql`
    update categories set
      registration_open = ${fd.get("registration_open") === "on"},
      registration_deadline = ${deadline}, max_teams = ${maxTeams},
      min_birth_year = ${minYear}, max_birth_year = ${maxYear}
    where id = ${categoryId}`;
  refreshCategory(categoryId);
  return { ok: true, message: "Ajustes de inscripción guardados" };
}

// ───────── Aceptar / rechazar ─────────

export async function acceptRegistration(registrationId: string): Promise<Result> {
  const admin = await requireAdmin();
  assertId(registrationId);
  const reg = await getRegistration(registrationId);
  if (!reg) return fail("Inscripción no encontrada");
  if (reg.status !== "pending_review") return fail("Solo se aceptan inscripciones confirmadas por ambos atletas");
  const category = await getRegCategory(reg.category.id);
  if (!category) return fail("Categoría no encontrada");
  if (category.has_format) return fail("La categoría ya generó su formato: reinícialo para agregar duplas");
  if (category.max_teams && category.accepted >= category.max_teams) return fail("La categoría ya completó su cupo");

  const problems = [
    ...profileIssues(reg.athlete1, category.start_date).map((m) => `${fullName(reg.athlete1)}: falta ${m}`),
    ...profileIssues(reg.athlete2, category.start_date).map((m) => `${fullName(reg.athlete2)}: falta ${m}`),
    ...eligibilityIssues(rulesOf(category), reg.athlete1, reg.athlete2),
    ...missingDeclarations(reg).map((a) => `Falta la declaración jurada de ${fullName(a)}`),
  ];
  if (problems.length) return fail(problems.join(". "));
  if (await activeRegistrationConflict(category.id, [reg.athlete1.id, reg.athlete2.id], reg.id)) {
    return fail("Uno de los atletas ya tiene otra inscripción activa en esta categoría");
  }

  const accepted = await sql.begin(async (tx) => {
    const [team] = await tx<{ id: string }[]>`
      insert into teams (category_id, player1, player2, seed, athlete1_id, athlete2_id)
      values (${category.id}, ${fullName(reg.athlete1)}, ${fullName(reg.athlete2)},
        (select coalesce(max(seed), 0) + 1 from teams where category_id = ${category.id}),
        ${reg.athlete1.id}, ${reg.athlete2.id})
      returning id`;
    const [updated] = await tx<{ id: string }[]>`
      update registrations set status = 'accepted', team_id = ${team.id}, decided_at = now(), decided_by = ${admin.id}, admin_note = null
      where id = ${reg.id} and status = 'pending_review' returning id`;
    if (!updated) throw new Error("La inscripción cambió mientras la revisabas; recarga la página");
    return true;
  });
  if (!accepted) return fail("No se pudo aceptar");

  for (const a of [reg.athlete1, reg.athlete2]) {
    await sendEmail({
      to: a.email,
      subject: `¡Inscripción aceptada! ${category.tournament_name}`,
      html: emailLayout(
        "¡Están inscritos!",
        [
          `La organización aceptó a la dupla <strong>${escapeHtml(fullName(reg.athlete1))} / ${escapeHtml(fullName(reg.athlete2))}</strong> en <strong>${escapeHtml(category.tournament_name)} · ${escapeHtml(category.name)}</strong>.`,
          "La programación y los resultados aparecerán en la página del torneo.",
        ],
        { label: "Ver el torneo", url: `${appUrl()}/torneos/${category.tournament_id}` },
      ),
    });
  }
  refreshCategory(category.id);
  return { ok: true, message: "Dupla aceptada y agregada a la categoría" };
}

export async function rejectRegistration(registrationId: string, note: string): Promise<Result> {
  const admin = await requireAdmin();
  assertId(registrationId);
  const reason = String(note ?? "").trim();
  if (reason.length < 3) return fail("Escribe el motivo: los atletas lo verán");
  const reg = await getRegistration(registrationId);
  if (!reg) return fail("Inscripción no encontrada");
  const [updated] = await sql<{ id: string }[]>`
    update registrations set status = 'rejected', admin_note = ${reason.slice(0, 500)}, decided_at = now(), decided_by = ${admin.id}
    where id = ${reg.id} and status in ('pending_partner', 'pending_review') returning id`;
  if (!updated) return fail("Esta inscripción ya no se puede rechazar (si ya fue aceptada, quita la dupla de la lista)");

  for (const a of [reg.athlete1, reg.athlete2]) {
    await sendEmail({
      to: a.email,
      subject: `Inscripción no aceptada · ${reg.category.tournament_name}`,
      html: emailLayout(
        "La inscripción no fue aceptada",
        [
          `La organización no aceptó la inscripción en <strong>${escapeHtml(reg.category.tournament_name)} · ${escapeHtml(reg.category.name)}</strong>.`,
          `<strong>Motivo:</strong> ${escapeHtml(reason)}`,
        ],
        { label: "Ver inscripción", url: `${appUrl()}/cuenta/inscripciones/${reg.id}` },
      ),
    });
  }
  refreshCategory(reg.category.id);
  return { ok: true, message: "Inscripción rechazada" };
}

// ───────── Atletas ─────────

/** Enlace de un solo uso (24 h) para que el atleta elija una nueva contraseña. */
export async function adminResetLink(athleteId: string): Promise<Result> {
  await requireAdmin();
  assertId(athleteId);
  const [a] = await sql<{ id: string }[]>`select id from athletes where id = ${athleteId}`;
  if (!a) return fail("Atleta no encontrado");
  return { ok: true, link: await createResetLinkForAdmin(a.id), message: "Enlace creado: vence en 24 horas" };
}

export async function adminVerifyEmail(athleteId: string): Promise<Result> {
  await requireAdmin();
  assertId(athleteId);
  await sql`update athletes set email_verified_at = coalesce(email_verified_at, now()) where id = ${athleteId}`;
  revalidatePath("/admin/atletas");
  return { ok: true, message: "Correo marcado como confirmado" };
}
