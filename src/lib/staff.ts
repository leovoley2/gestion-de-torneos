import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { sql } from "@/lib/db";
import { appUrl } from "@/lib/email";
import { hashPassword } from "@/lib/password";

// Enlaces de activación del equipo: el administrador general invita a alguien y le envía el
// enlace (por WhatsApp o correo); la persona elige su contraseña. Se guarda solo el hash.

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Contraseña imposible de adivinar para cuentas que aún no se activaron. */
export const unusablePasswordHash = () => hashPassword(randomBytes(32).toString("base64url"));

export async function createActivationLink(adminId: string): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await sql`update admin_tokens set used_at = now() where admin_id = ${adminId} and used_at is null`;
  await sql`
    insert into admin_tokens (token_hash, admin_id, expires_at)
    values (${sha256(raw)}, ${adminId}, now() + interval '72 hours')`;
  return `${appUrl()}/login/activar?token=${raw}`;
}

/** Usa el enlace: guarda la contraseña y devuelve el id del miembro, o null si no sirve. */
export async function activateWithToken(raw: string, password: string): Promise<string | null> {
  if (!raw || raw.length > 100) return null;
  const [row] = await sql<{ admin_id: string }[]>`
    update admin_tokens set used_at = now()
    where token_hash = ${sha256(raw)} and used_at is null and expires_at > now()
    returning admin_id`;
  if (!row) return null;
  await sql`update admins set password_hash = ${await hashPassword(password)} where id = ${row.admin_id}`;
  return row.admin_id;
}
