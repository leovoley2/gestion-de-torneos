import "server-only";
import { cookies, headers } from "next/headers";
import { sql } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { can, type Permission, type RoleGrant } from "@/lib/permissions";
import { SESSION_COOKIE, SESSION_DAYS, readSession, signSession } from "@/lib/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Admin {
  id: string;
  email: string;
  name: string | null;
  grants: RoleGrant[];
}

/**
 * Miembro del equipo de la sesión actual (con sus roles), o null. Se consulta la base: borrar a
 * alguien o quitarle todos sus roles revoca su acceso de inmediato.
 */
export async function getAdmin(): Promise<Admin | null> {
  const id = await readSession((await cookies()).get(SESSION_COOKIE)?.value, "admin");
  if (!id) return null;
  const [admin] = await sql<Omit<Admin, "grants">[]>`select id, email, name from admins where id = ${id}`;
  if (!admin) return null;
  const grants = await sql<RoleGrant[]>`select role, tournament_id from admin_roles where admin_id = ${id}`;
  if (grants.length === 0) return null;
  return { ...admin, grants: [...grants] };
}

export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) throw new Error("Solo los administradores pueden hacer cambios");
  return admin;
}

/**
 * Exige un permiso. El alcance puede ser un torneo o una categoría (se busca su torneo).
 * Primero exige sesión del equipo; luego el rol adecuado para ese torneo.
 */
export async function requirePermission(
  permission: Permission,
  scope: { tournamentId?: string; categoryId?: string; registrationId?: string } = {},
): Promise<Admin> {
  const admin = await requireAdmin();
  for (const id of [scope.tournamentId, scope.categoryId, scope.registrationId]) {
    if (id !== undefined && !UUID.test(id)) throw new Error("Identificador inválido");
  }
  let tournamentId = scope.tournamentId;
  if (scope.categoryId || scope.registrationId) {
    const [c] = scope.categoryId
      ? await sql<{ tournament_id: string }[]>`select tournament_id from categories where id = ${scope.categoryId}`
      : await sql<{ tournament_id: string }[]>`
          select c.tournament_id from registrations r join categories c on c.id = r.category_id where r.id = ${scope.registrationId!}`;
    if (!c) throw new Error("No encontrado");
    tournamentId = c.tournament_id;
  }
  if (!can(admin.grants, permission, tournamentId)) throw new Error("No tienes permiso para esta acción");
  return admin;
}

// ───────── Límite de intentos (compartido por administradores y atletas) ─────────

export const MAX_FAILS_PER_EMAIL = 5;
export const MAX_FAILS_PER_IP = 20;
const LOCK_MINUTES = 15;

/** Hash ficticio: se verifica igual cuando el correo no existe, para no revelarlo por el tiempo. */
export const DUMMY_HASH = "scrypt$00000000000000000000000000000000$" + "0".repeat(128);

export type LoginResult = "ok" | "invalid" | "locked";

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/** ¿Hay demasiados fallos recientes para esta clave (correo) o esta IP? */
export async function isLocked(key: string, ip: string | null): Promise<boolean> {
  const [recent] = await sql<{ by_email: number; by_ip: number }[]>`
    select count(*) filter (where email = ${key})::int as by_email,
           count(*) filter (where ip is not null and ip = ${ip})::int as by_ip
    from login_attempts
    where attempted_at > now() - make_interval(mins => ${LOCK_MINUTES})`;
  return (recent?.by_email ?? 0) >= MAX_FAILS_PER_EMAIL || (recent?.by_ip ?? 0) >= MAX_FAILS_PER_IP;
}

export async function recordFailure(key: string, ip: string | null) {
  await sql`insert into login_attempts (email, ip) values (${key}, ${ip})`;
  await sql`delete from login_attempts where attempted_at < now() - interval '1 day'`;
}

export async function clearFailures(key: string) {
  await sql`delete from login_attempts where email = ${key}`;
}

export async function setSessionCookie(name: string, token: string, days: number) {
  (await cookies()).set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: days * 24 * 60 * 60,
  });
}

/**
 * Inicia sesión de administrador. Tras 5 fallos del mismo correo (o 20 desde la misma IP) en
 * 15 minutos, bloquea temporalmente sin siquiera verificar la contraseña.
 */
export async function login(rawEmail: string, password: string): Promise<LoginResult> {
  const email = rawEmail.trim().toLowerCase();
  const ip = await clientIp();
  if (await isLocked(email, ip)) return "locked";

  const [row] = await sql<{ id: string; password_hash: string }[]>`
    select id, password_hash from admins where email = ${email}`;
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) {
    await recordFailure(email, ip);
    return "invalid";
  }

  await clearFailures(email);
  await setSessionCookie(SESSION_COOKIE, await signSession(row.id, "admin"), SESSION_DAYS);
  return "ok";
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}
