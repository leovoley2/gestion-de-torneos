"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAthlete, requireAthlete, sendVerificationEmail, athleteLogout } from "@/lib/athlete-auth";
import { verifyPassword } from "@/lib/password";
import { POLICY_VERSION } from "@/lib/legal";
import {
  DOCUMENT_TYPES,
  eligibilityIssues,
  fullName,
  isMinor,
  needsGuardianConsent,
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
  paymentStatus,
  rulesOf,
  voucherType,
} from "@/lib/registrations";
import { MAX_PDF_BYTES, deletePrivateFile, isPdf, savePrivateFile } from "@/lib/storage";
import { tooBigMessage } from "@/lib/upload-limits";

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
  // Menores de 14: el apoderado debe autorizar el tratamiento de los datos (Ley 29733).
  const under14 = needsGuardianConsent({ birthdate, guardian_consent_at: null });
  const guardianConsent = fd.get("guardian_consent") === "on";
  if (under14 && !guardianConsent && !me.guardian_consent_at) {
    return fail("El padre, madre o apoderado debe marcar la autorización del tratamiento de datos");
  }

  try {
    await sql`
      update athletes set
        first_name = ${firstName}, last_name = ${lastName},
        document_type = ${documentType}, document_number = ${documentNumber},
        birthdate = ${birthdate}, gender = ${gender || null},
        phone = ${optional(fd, "phone")}, city = ${optional(fd, "city")}, club = ${optional(fd, "club")},
        guardian_name = ${optional(fd, "guardian_name")}, guardian_document = ${optional(fd, "guardian_document")},
        guardian_phone = ${optional(fd, "guardian_phone")}, guardian_relationship = ${optional(fd, "guardian_relationship")},
        guardian_consent_at = ${under14 ? (me.guardian_consent_at ? sql`guardian_consent_at` : sql`now()`) : null},
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
  // Nombre, club y ciudad salen en su perfil público, en el ranking y en las duplas.
  revalidatePath(`/atletas/${me.id}`);
  revalidatePath("/ranking", "layout");
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

/** Para inscribirse hay que haber aceptado la versión vigente de la Política de privacidad. */
const privacyMissing = (a: Athlete) =>
  a.privacy_version === POLICY_VERSION ? null : "Primero acepta la Política de privacidad (aviso arriba de la página)";

export async function createRegistration(_: Result | null, fd: FormData): Promise<Result> {
  const me = await requireAthlete();
  const noPrivacy = privacyMissing(me);
  if (noPrivacy) return fail(noPrivacy);
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

export type PartnerLookup =
  | { ok: true; partner: { short: string; initials: string; club: string | null }; issues: string[] }
  | { ok: false; error: string };

/**
 * Verifica al compañero ANTES de enviar la invitación: que exista, que tenga cuenta y si pueden jugar
 * juntos la categoría. Solo devuelve nombre + inicial del apellido y club (no expone otros datos).
 */
export async function lookupPartner(categoryId: string, query: string): Promise<PartnerLookup> {
  const me = await requireAthlete();
  if (!isUuid(categoryId)) return { ok: false, error: "Elige primero la categoría" };
  const q = String(query ?? "").trim();
  if (q.length < 5) return { ok: false, error: "Escribe el correo o número de documento completo" };
  const [category, partner] = await Promise.all([getRegCategory(categoryId), findAthleteByEmailOrDocument(q)]);
  if (!category) return { ok: false, error: "Categoría no encontrada" };
  if (!partner) {
    return { ok: false, error: "No encontramos a nadie con ese dato. Tu compañero debe crear su cuenta y darte el correo o documento con el que se registró." };
  }
  if (partner.id === me.id) return { ok: false, error: "Ese eres tú: escribe el dato de tu compañero" };
  if (!partner.email) return { ok: false, error: "Tu compañero todavía no tiene cuenta: debe registrarse para poder confirmar la inscripción." };
  const issues: string[] = [];
  if (partner.gender) issues.push(...eligibilityIssues(rulesOf(category), me, partner));
  const conflict = await activeRegistrationConflict(categoryId, [me.id, partner.id]);
  if (conflict) issues.push(conflict === me.id ? "Ya tienes una inscripción activa en esta categoría" : "Tu compañero ya tiene una inscripción activa en esta categoría");
  const first = partner.first_name.trim().split(/\s+/)[0] ?? "";
  const lastInitial = partner.last_name.trim()[0];
  const short = [first, lastInitial ? `${lastInitial.toUpperCase()}.` : ""].filter(Boolean).join(" ") || "Atleta registrado";
  return {
    ok: true,
    partner: { short, initials: `${first[0] ?? ""}${lastInitial ?? ""}`.toUpperCase() || "?", club: partner.club },
    issues,
  };
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
    const noPrivacy = privacyMissing(me);
    if (noPrivacy) return fail(noPrivacy);
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
  if (file.size > MAX_PDF_BYTES) return fail(tooBigMessage(file.size));
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

// ───────── Pago de la inscripción ─────────

const VOUCHER_EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Sube (o reemplaza) el comprobante de pago. Cualquiera de los dos atletas puede hacerlo. */
export async function uploadPaymentVoucher(registrationId: string, fd: FormData): Promise<Result> {
  const me = await requireAthlete();
  const reg = await myRegistration(registrationId, me);
  if (!reg) return fail("Inscripción no encontrada");
  if (!["pending_partner", "pending_review", "accepted"].includes(reg.status)) return fail("Esta inscripción ya no admite cambios");
  const status = paymentStatus(reg);
  if (status === "free") return fail("Esta categoría no tiene costo de inscripción");
  if (status === "paid") return fail("La organización ya confirmó el pago");

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Elige la foto o el PDF del comprobante");
  if (file.size > MAX_PDF_BYTES) return fail(tooBigMessage(file.size));
  const data = Buffer.from(await file.arrayBuffer());
  const type = voucherType(data);
  if (!type) return fail("El comprobante debe ser una foto (JPG, PNG o WEBP) o un PDF");

  const key = await savePrivateFile(`pagos/${reg.id}.${VOUCHER_EXT[type]}`, data, type);
  const name = file.name.replace(/[^\w .()-]/g, "_").slice(0, 120) || `comprobante.${VOUCHER_EXT[type]}`;
  const [old] = await sql<{ payment_file_key: string | null }[]>`select payment_file_key from registrations where id = ${reg.id}`;
  await sql`
    update registrations set payment_file_key = ${key}, payment_file_name = ${name}, payment_file_type = ${type},
      payment_uploaded_at = now()
    where id = ${reg.id}`;
  if (old?.payment_file_key && old.payment_file_key !== key) await deletePrivateFile(old.payment_file_key);
  revalidatePath(`/cuenta/inscripciones/${reg.id}`);
  revalidatePath(`/admin/categorias/${reg.category.id}`);
  return { ok: true, message: "Comprobante enviado. La organización lo revisará." };
}

// ───────── Privacidad ─────────

/** Acepta la versión vigente de la Política de privacidad (cuentas creadas antes de que existiera). */
export async function acceptPrivacy(): Promise<Result> {
  const me = await getAthlete();
  if (!me) throw new Error("Inicia sesión con tu cuenta de atleta");
  await sql`update athletes set privacy_accepted_at = now(), privacy_version = ${POLICY_VERSION} where id = ${me.id}`;
  revalidatePath("/cuenta", "layout");
  return { ok: true, message: "Gracias. Política aceptada." };
}

/**
 * Elimina la cuenta y los datos personales (derecho de cancelación). Pide la contraseña.
 * Los resultados quedan como registro histórico con el nombre escrito en la dupla; el vínculo con la
 * cuenta (y sus puntos individuales de ranking) desaparece. No se puede con inscripciones en curso.
 */
export async function deleteAccount(_: Result | null, fd: FormData): Promise<Result> {
  const me = await getAthlete();
  if (!me) throw new Error("Inicia sesión con tu cuenta de atleta");
  const [row] = await sql<{ password_hash: string }[]>`select password_hash from athletes where id = ${me.id}`;
  if (!row || !(await verifyPassword(String(fd.get("password") ?? ""), row.password_hash))) {
    return fail("La contraseña no es correcta");
  }
  const [{ active }] = await sql<{ active: number }[]>`
    select count(*)::int as active from registrations r join categories c on c.id = r.category_id
    where (r.athlete1_id = ${me.id} or r.athlete2_id = ${me.id})
      and (r.status in ('pending_partner', 'pending_review') or (r.status = 'accepted' and c.status <> 'finished'))`;
  if (active > 0) {
    return fail(
      "Tienes inscripciones pendientes o en un torneo que aún no termina. Retíralas o espera a que termine el torneo; si necesitas ayuda escribe a la organización.",
    );
  }
  const files = await sql<{ file_key: string }[]>`
    select file_key from declarations where athlete_id = ${me.id}
    union all
    select payment_file_key from registrations
    where payment_file_key is not null and (athlete1_id = ${me.id} or athlete2_id = ${me.id})`;
  for (const f of files) await deletePrivateFile(f.file_key).catch(() => {});
  // Cascada: enlaces, inscripciones y declaraciones. Las duplas conservan el nombre escrito (athlete_id = null).
  await sql`delete from athletes where id = ${me.id}`;
  await sql`delete from login_attempts where email = ${me.email ?? ""}`;
  await athleteLogout();
  revalidatePath("/", "layout");
  redirect("/cuenta/ingresar?cuenta=eliminada");
}
