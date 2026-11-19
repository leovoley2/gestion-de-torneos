import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { ATHLETE_COOKIE, ATHLETE_SESSION_DAYS, readSession, signSession } from "@/lib/session";
import { DUMMY_HASH, clearFailures, clientIp, isLocked, recordFailure, setSessionCookie, type LoginResult } from "@/lib/auth";
import { appUrl, emailLayout, escapeHtml, isEmailEnabled, sendEmail } from "@/lib/email";
import type { Athlete } from "@/lib/athletes";

export const MIN_PASSWORD = 8;
const SIGNUPS_PER_IP_PER_HOUR = 5;
// Las claves del límite de intentos llevan prefijo para no mezclarse con las de administradores.
const lockKey = (email: string) => `atleta:${email}`;

export const normalizeEmail = (s: string) => s.trim().toLowerCase();
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Atleta de la sesión actual, o null. */
export async function getAthlete(): Promise<Athlete | null> {
  const id = await readSession((await cookies()).get(ATHLETE_COOKIE)?.value, "athlete");
  if (!id) return null;
  const [athlete] = await sql<Athlete[]>`select * from athletes where id = ${id}`;
  return athlete ?? null;
}

/**
 * Exige sesión de atleta. Si el envío de correos está activo, también exige el correo verificado
 * (sin proveedor de correo no hay forma de verificar, así que no se exige).
 */
export async function requireAthlete(): Promise<Athlete> {
  const athlete = await getAthlete();
  if (!athlete) throw new Error("Inicia sesión con tu cuenta de atleta");
  if (isEmailEnabled() && !athlete.email_verified_at) throw new Error("Primero verifica tu correo");
  return athlete;
}

// ───────── Enlaces de un solo uso ─────────

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function createToken(athleteId: string, purpose: "verify" | "reset", hours: number): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await sql`
    insert into athlete_tokens (token_hash, athlete_id, purpose, expires_at)
    values (${sha256(raw)}, ${athleteId}, ${purpose}, now() + make_interval(hours => ${hours}))`;
  return raw;
}

/** Marca el enlace como usado y devuelve el atleta, o null si no sirve (usado, vencido o falso). */
async function consumeToken(raw: string, purpose: "verify" | "reset"): Promise<string | null> {
  if (!raw || raw.length > 100) return null;
  const [row] = await sql<{ athlete_id: string }[]>`
    update athlete_tokens set used_at = now()
    where token_hash = ${sha256(raw)} and purpose = ${purpose} and used_at is null and expires_at > now()
    returning athlete_id`;
  return row?.athlete_id ?? null;
}

export async function sendVerificationEmail(athlete: Pick<Athlete, "id" | "email" | "first_name">) {
  const token = await createToken(athlete.id, "verify", 48);
  await sendEmail({
    to: athlete.email,
    subject: "Confirma tu correo",
    html: emailLayout(
      `Hola${athlete.first_name ? `, ${escapeHtml(athlete.first_name)}` : ""}`,
      ["Confirma tu correo para activar tu cuenta de atleta y poder inscribirte en los torneos."],
      { label: "Confirmar correo", url: `${appUrl()}/cuenta/verificar?token=${token}` },
    ),
  });
}

// ───────── Registro e inicio de sesión ─────────

export type SignupResult = { ok: true } | { ok: false; error: string };

export async function signup(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<SignupResult> {
  const email = normalizeEmail(input.email);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!isEmail(email)) return { ok: false, error: "Escribe un correo válido" };
  if (!firstName || !lastName) return { ok: false, error: "Escribe tus nombres y apellidos" };
  if (input.password.length < MIN_PASSWORD) {
    return { ok: false, error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres` };
  }

  const ip = await clientIp();
  if (ip) {
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from athletes where created_ip = ${ip} and created_at > now() - interval '1 hour'`;
    if (n >= SIGNUPS_PER_IP_PER_HOUR) return { ok: false, error: "Demasiados registros desde esta conexión. Intenta más tarde." };
  }

  const [created] = await sql<Pick<Athlete, "id" | "email" | "first_name">[]>`
    insert into athletes (email, password_hash, first_name, last_name, created_ip)
    values (${email}, ${await hashPassword(input.password)}, ${firstName}, ${lastName}, ${ip})
    on conflict (email) do nothing
    returning id, email, first_name`;
  if (!created) return { ok: false, error: "Ya existe una cuenta con ese correo. Ingresa o recupera tu contraseña." };

  await sendVerificationEmail(created);
  await setSessionCookie(ATHLETE_COOKIE, await signSession(created.id, "athlete"), ATHLETE_SESSION_DAYS);
  return { ok: true };
}

export async function athleteLogin(rawEmail: string, password: string): Promise<LoginResult> {
  const email = normalizeEmail(rawEmail);
  const ip = await clientIp();
  if (await isLocked(lockKey(email), ip)) return "locked";
  const [row] = await sql<{ id: string; password_hash: string }[]>`
    select id, password_hash from athletes where email = ${email}`;
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) {
    await recordFailure(lockKey(email), ip);
    return "invalid";
  }
  await clearFailures(lockKey(email));
  await setSessionCookie(ATHLETE_COOKIE, await signSession(row.id, "athlete"), ATHLETE_SESSION_DAYS);
  return "ok";
}

export async function athleteLogout() {
  (await cookies()).delete(ATHLETE_COOKIE);
}

export async function verifyEmail(token: string): Promise<boolean> {
  const id = await consumeToken(token, "verify");
  if (!id) return false;
  await sql`update athletes set email_verified_at = coalesce(email_verified_at, now()) where id = ${id}`;
  return true;
}

/** Envía el enlace si la cuenta existe. Siempre responde igual (no revela qué correos existen). */
export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const [row] = await sql<Pick<Athlete, "id" | "email" | "first_name">[]>`
    select id, email, first_name from athletes where email = ${email}`;
  if (!row) return;
  const token = await createToken(row.id, "reset", 2);
  await sendEmail({
    to: row.email,
    subject: "Restablece tu contraseña",
    html: emailLayout(
      "Restablece tu contraseña",
      ["Recibimos un pedido para cambiar la contraseña de tu cuenta. El enlace vence en 2 horas.", "Si no fuiste tú, ignora este correo."],
      { label: "Elegir nueva contraseña", url: `${appUrl()}/cuenta/restablecer?token=${token}` },
    ),
  });
}

/** Enlace para restablecer generado por un administrador (cuando no hay correo configurado). */
export async function createResetLinkForAdmin(athleteId: string): Promise<string> {
  const token = await createToken(athleteId, "reset", 24);
  return `${appUrl()}/cuenta/restablecer?token=${token}`;
}

export async function resetPassword(token: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres` };
  }
  const id = await consumeToken(token, "reset");
  if (!id) return { ok: false, error: "El enlace no es válido o ya venció. Pide uno nuevo." };
  // Restablecer por correo también prueba que el correo es suyo.
  await sql`
    update athletes set password_hash = ${await hashPassword(password)},
      email_verified_at = coalesce(email_verified_at, now()), updated_at = now()
    where id = ${id}`;
  await sql`update athlete_tokens set used_at = now() where athlete_id = ${id} and purpose = 'reset' and used_at is null`;
  await setSessionCookie(ATHLETE_COOKIE, await signSession(id, "athlete"), ATHLETE_SESSION_DAYS);
  return { ok: true };
}
