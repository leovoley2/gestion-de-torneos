"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAthlete, requireAthlete, sendVerificationEmail } from "@/lib/athlete-auth";
import {
  DOCUMENT_TYPES,
  eligibilityIssues,
  fullName,
  isMinor,
  profileIssues,
  registrationClosedReason,
  type Athlete,
} from "@/lib/athletes";
import { isUuid } from "@/lib/data";
import { sql } from "@/lib/db";
import { appUrl, emailLayout, escapeHtml, sendEmail } from "@/lib/email";
import {
  activeRegistrationConflict,
  findAthleteByEmailOrDocument,
  getRegCategory,
  getRegistration,
  rulesOf,
} from "@/lib/registrations";
import { MAX_PDF_BYTES, deletePrivateFile, isPdf, savePrivateFile } from "@/lib/storage";

// TODA acción de este archivo exige sesión de atleta (requireAthlete) y solo actúa sobre el atleta de la
// sesión o sobre inscripciones donde él participa. cuenta/actions.test.ts lo verifica.

type Result = { ok: true; message?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optional = (fd: FormData, k: string) => text(fd, k) || null;

// ───────── Perfil ─────────

export async function updateProfile(_: Result | null, fd: FormData): Promise<Result> {
  const me = await requireAthlete();
  const documentType = text(fd, "document_type");
  if (!(documentType in DOCUMENT_TYPES)) return fail("Tipo de documento inválido");
  const birthdate = optional(fd, "birthdate");
  if (birthdate && (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate) || birthdate > new Date().toISOString().slice(0, 10))) {
    return fail("Fecha de nacimiento inválida");
  }
  const gender = text(fd, "gender");
  if (gender && gender !== "F" && gender !== "M") return fail("Sexo inválido");
  const firstName = text(fd, "first_name");
  const lastName = text(fd, "last_name");
  if (!firstName || !lastName) return fail("Escribe tus nombres y apellidos");
  const documentNumber = optional(fd, "document_number")?.toUpperCase().replace(/\s+/g, "") ?? null;
  if (documentNumber && !/^[A-Z0-9-]{5,20}$/.test(documentNumber)) return fail("Número de documento inválido");

  try {
    await sql`
      update athletes set
        first_name = ${firstName}, last_name = ${lastName},
        document_type = ${documentType}, document_number = ${documentNumber},
        birthdate = ${birthdate}, gender = ${gender || null},
        phone = ${optional(fd, "phone")}, city = ${optional(fd, "city")}, club = ${optional(fd, "club")},
        guardian_name = ${optional(fd, "guardian_name")}, guardian_document = ${optional(fd, "guardian_document")},
        guardian_phone = ${optional(fd, "guardian_phone")}, guardian_relationship = ${optional(fd, "guardian_relationship")},
        updated_at = now()
      where id = ${me.id}`;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      const [owner] = await sql<{ email: string | null }[]>`
        select email from athletes where document_type = ${documentType} and document_number = ${documentNumber}`;
      return fail(
        owner && !owner.email
          ? "La organización ya tiene una ficha con ese documento (con tus resultados). Pídele que la una a tu cuenta; mientras tanto deja el documento vacío."
          : "Ese documento ya está registrado en otra cuenta",
      );
    }
    throw e;
  }
  revalidatePath("/cuenta", "layout");
  return { ok: true, message: "Perfil guardado" };
}

export async function resendVerification(): Promise<Result> {
  // Solo exige sesión (no correo verificado: justamente sirve para verificarlo).
  const athlete = await getAthlete();
  if (!athlete) throw new Error("Inicia sesión con tu cuenta de atleta");
  if (athlete.email_verified_at) return { ok: true, message: "Tu correo ya está confirmado" };
  await sendVerificationEmail(athlete);
  return { ok: true, message: "Te enviamos un nuevo enlace de confirmación" };
}

// ───────── Inscripciones ─────────

const label = (a: Athlete) => fullName(a) || a.email || "Atleta";

export async function createRegistration(_: Result | null, fd: FormData): Promise<Result> {
  const me = await requireAthlete();
  const categoryId = text(fd, "category_id");
  if (!isUuid(categoryId)) return fail("Elige una categoría");
  const category = await getRegCategory(categoryId);
  if (!category) return fail("Categoría no encontrada");

  const closed = registrationClosedReason(rulesOf(category), category.published);
  if (closed) return fail(closed);
  if (category.max_teams && category.accepted >= category.max_teams) return fail("La categoría ya completó su cupo");

  const myIssues = profileIssues(me, category.start_date);
  if (myIssues.length) return fail(`Completa tu perfil antes de inscribirte: falta ${myIssues.join(", ")}`);

  const partner = await findAthleteByEmailOrDocument(text(fd, "partner"));
  if (!partner) {
    return fail("No encontramos a tu compañero. Debe crear su cuenta y darte el correo o documento con el que se registró.");
  }
  if (partner.id === me.id) return fail("Tu compañero debe ser otra persona");
  if (!partner.email) {
    return fail("Tu compañero todavía no tiene cuenta: debe registrarse para poder confirmar la inscripción.");
  }

  const conflict = await activeRegistrationConflict(categoryId, [me.id, partner.id]);
  if (conflict) {
    return fail(conflict === me.id ? "Ya tienes una inscripción activa en esta categoría" : `${label(partner)} ya tiene una inscripción activa en esta categoría`);
  }
  // Si el compañero ya tiene sexo y fecha, se valida ahora; si no, al confirmar.
  if (partner.gender) {
    const issues = eligibilityIssues(rulesOf(category), me, partner);
    if (issues.length) return fail(issues.join(". "));
  }

  const [reg] = await sql<{ id: string }[]>`
    insert into registrations (category_id, athlete1_id, athlete2_id)
    values (${categoryId}, ${me.id}, ${partner.id}) returning id`;

  await sendEmail({
    to: partner.email,
    subject: `${label(me)} te invitó a jugar en ${category.tournament_name}`,
    html: emailLayout(
      "Tienes una invitación de dupla",
      [
        `<strong>${escapeHtml(label(me))}</strong> quiere inscribirse contigo en <strong>${escapeHtml(category.tournament_name)} · ${escapeHtml(category.name)}</strong>.`,
        "Entra a tu cuenta para aceptar o rechazar la invitación.",
      ],
      { label: "Ver invitación", url: `${appUrl()}/cuenta/inscripciones/${reg.id}` },
    ),
  });
  revalidatePath("/cuenta", "layout");
  redirect(`/cuenta/inscripciones/${reg.id}`);
}

async function myRegistration(registrationId: string, me: Athlete) {
  if (!isUuid(registrationId)) return null;
  const reg = await getRegistration(registrationId);
  if (!reg || (reg.athlete1.id !== me.id && reg.athlete2.id !== me.id)) return null;
  return reg;
}

export async function respondInvitation(registrationId: string, accept: boolean): Promise<Result> {
  const me = await requireAthlete();
  const reg = await myRegistration(registrationId, me);
  if (!reg || reg.athlete2.id !== me.id) return fail("Invitación no encontrada");
  if (reg.status !== "pending_partner") return fail("Esta invitación ya fue respondida");

  if (accept) {
    const closed = registrationClosedReason(rulesOf(reg.category), reg.category.published);
    if (closed) return fail(closed);
    const myIssues = profileIssues(me, reg.category.start_date);
    if (myIssues.length) return fail(`Completa tu perfil antes de aceptar: falta ${myIssues.join(", ")}`);
    const issues = eligibilityIssues(rulesOf(reg.category), reg.athlete1, me);
    if (issues.length) return fail(issues.join(". "));
    if (await activeRegistrationConflict(reg.category.id, [me.id], reg.id)) {
      return fail("Ya tienes otra inscripción activa en esta categoría");
    }
  }

  const [updated] = await sql<{ id: string }[]>`
    update registrations set status = ${accept ? "pending_review" : "declined"}, partner_answered_at = now()
    where id = ${reg.id} and status = 'pending_partner' returning id`;
  if (!updated) return fail("Esta invitación ya fue respondida");

  await sendEmail({
    to: reg.athlete1.email,
    subject: accept ? "Tu compañero aceptó la inscripción" : "Tu compañero no aceptó la inscripción",
    html: emailLayout(
      accept ? "¡Dupla confirmada!" : "Invitación rechazada",
      [
        accept
          ? `${escapeHtml(label(me))} aceptó. La inscripción en <strong>${escapeHtml(reg.category.tournament_name)} · ${escapeHtml(reg.category.name)}</strong> pasó a revisión de la organización.`
          : `${escapeHtml(label(me))} no aceptó la invitación para ${escapeHtml(reg.category.tournament_name)} · ${escapeHtml(reg.category.name)}.`,
      ],
      { label: "Ver inscripción", url: `${appUrl()}/cuenta/inscripciones/${reg.id}` },
    ),
  });
  revalidatePath("/cuenta", "layout");
  return { ok: true, message: accept ? "Aceptaste la invitación: la organización revisará la inscripción" : "Rechazaste la invitación" };
}

export async function withdrawRegistration(registrationId: string): Promise<Result> {
  const me = await requireAthlete();
  const reg = await myRegistration(registrationId, me);
  if (!reg) return fail("Inscripción no encontrada");
  const [updated] = await sql<{ id: string }[]>`
    update registrations set status = 'withdrawn'
    where id = ${reg.id} and status in ('pending_partner', 'pending_review') returning id`;
  if (!updated) {
    return fail(reg.status === "accepted" ? "La inscripción ya fue aceptada: para retirarte escribe a la organización" : "Esta inscripción ya no se puede retirar");
  }
  revalidatePath("/cuenta", "layout");
  return { ok: true, message: "Inscripción retirada" };
}

// ───────── Declaración jurada (menores) ─────────

export async function uploadDeclaration(registrationId: string, fd: FormData): Promise<Result> {
  const me = await requireAthlete();
  const reg = await myRegistration(registrationId, me);
  if (!reg) return fail("Inscripción no encontrada");
  if (!isMinor(me, reg.category.start_date)) return fail("La declaración jurada solo se pide a menores de edad");
  if (!["pending_partner", "pending_review"].includes(reg.status)) return fail("Esta inscripción ya no admite cambios");

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Elige el archivo PDF");
  if (file.size > MAX_PDF_BYTES) return fail("El PDF pesa más de 5 MB");
  const data = Buffer.from(await file.arrayBuffer());
  if (!isPdf(data)) return fail("El archivo debe ser un PDF");

  const key = await savePrivateFile(`declaraciones/${reg.id}/${me.id}.pdf`, data, "application/pdf");
  const name = file.name.replace(/[^\w .()-]/g, "_").slice(0, 120) || "declaracion.pdf";
  const [old] = await sql<{ file_key: string }[]>`
    select file_key from declarations where registration_id = ${reg.id} and athlete_id = ${me.id}`;
  await sql`
    insert into declarations (registration_id, athlete_id, file_key, file_name, file_size)
    values (${reg.id}, ${me.id}, ${key}, ${name}, ${file.size})
    on conflict (registration_id, athlete_id) do update
      set file_key = excluded.file_key, file_name = excluded.file_name, file_size = excluded.file_size, uploaded_at = now()`;
  if (old && old.file_key !== key) await deletePrivateFile(old.file_key);
  revalidatePath(`/cuenta/inscripciones/${reg.id}`);
  return { ok: true, message: "Declaración jurada subida" };
}
