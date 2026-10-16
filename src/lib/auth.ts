import "server-only";
import { cookies } from "next/headers";
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

export async function login(email: string, password: string): Promise<boolean> {
  const [row] = await sql<{ id: string; password_hash: string }[]>`
    select id, password_hash from admins where email = ${email.trim().toLowerCase()}`;
  // Se verifica igual con un hash ficticio para no revelar si el correo existe.
  const ok = await verifyPassword(
    password,
    row?.password_hash ?? "scrypt$00000000000000000000000000000000$" + "0".repeat(128),
  );
  if (!row || !ok) {
    await new Promise((r) => setTimeout(r, 400)); // frena intentos repetidos
    return false;
  }
  (await cookies()).set(SESSION_COOKIE, await signSession(row.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return true;
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}
