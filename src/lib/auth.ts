import "server-only";
import { cookies, headers } from "next/headers";
import { sql } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { SESSION_COOKIE, SESSION_DAYS, readSession, signSession } from "@/lib/session";

export interface Admin {
  id: string;
  email: string;
}

/** Admin de la sesión actual, o null. Se consulta la base: borrar un admin revoca su sesión. */
export async function getAdmin(): Promise<Admin | null> {
  const id = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!id) return null;
  const [admin] = await sql<Admin[]>`select id, email from admins where id = ${id}`;
  return admin ?? null;
}

export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) throw new Error("Solo los administradores pueden hacer cambios");
  return admin;
}

export const MAX_FAILS_PER_EMAIL = 5;
export const MAX_FAILS_PER_IP = 20;
const LOCK_MINUTES = 15;

export type LoginResult = "ok" | "invalid" | "locked";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/**
 * Inicia sesión. Tras 5 fallos del mismo correo (o 20 desde la misma IP) en 15 minutos,
 * bloquea temporalmente sin siquiera verificar la contraseña.
 */
export async function login(rawEmail: string, password: string): Promise<LoginResult> {
  const email = rawEmail.trim().toLowerCase();
  const ip = await clientIp();

  const [recent] = await sql<{ by_email: number; by_ip: number }[]>`
    select count(*) filter (where email = ${email})::int as by_email,
           count(*) filter (where ip is not null and ip = ${ip})::int as by_ip
    from login_attempts
    where attempted_at > now() - make_interval(mins => ${LOCK_MINUTES})`;
  if ((recent?.by_email ?? 0) >= MAX_FAILS_PER_EMAIL || (recent?.by_ip ?? 0) >= MAX_FAILS_PER_IP) {
    return "locked";
  }

  const [row] = await sql<{ id: string; password_hash: string }[]>`
    select id, password_hash from admins where email = ${email}`;
  // Se verifica igual con un hash ficticio para no revelar si el correo existe.
  const ok = await verifyPassword(
    password,
    row?.password_hash ?? "scrypt$00000000000000000000000000000000$" + "0".repeat(128),
  );
  if (!row || !ok) {
    await sql`insert into login_attempts (email, ip) values (${email}, ${ip})`;
    await sql`delete from login_attempts where attempted_at < now() - interval '1 day'`;
    return "invalid";
  }

  await sql`delete from login_attempts where email = ${email}`;
  (await cookies()).set(SESSION_COOKIE, await signSession(row.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return "ok";
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}
