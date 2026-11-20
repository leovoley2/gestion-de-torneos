"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ROLE_INFO, type Role } from "@/lib/permissions";
import { createActivationLink, unusablePasswordHash } from "@/lib/staff";
import { emailLayout, escapeHtml, isEmailEnabled, sendEmail } from "@/lib/email";

// Equipo de la organización. TODA acción empieza con requirePermission("staff.manage"): solo el
// administrador general invita, cambia roles o quita acceso. (actions.test.ts recorre este archivo.)

type Result = { ok: true; message?: string; link?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRole = (r: string): r is Role => r in ROLE_INFO;

/** Con los correos activos, el enlace de acceso también le llega a la persona por correo. */
async function emailActivationLink(adminId: string, link: string): Promise<boolean> {
  if (!isEmailEnabled()) return false;
  const [a] = await sql<{ email: string; name: string }[]>`select email, name from admins where id = ${adminId}`;
  if (!a) return false;
  const r = await sendEmail({
    to: a.email,
    subject: "Tu acceso al panel de torneos",
    html: emailLayout(
      `Hola${a.name ? `, ${escapeHtml(a.name.split(" ")[0])}` : ""}`,
      ["Te dieron acceso al panel de la organización. Elige tu contraseña con este enlace (vence en 72 horas)."],
      { label: "Elegir contraseña", url: link },
    ),
  });
  return r.ok && r.sent;
}

async function superadminCount(exceptAdminId?: string) {
  const [{ n }] = await sql<{ n: number }[]>`
    select count(distinct admin_id)::int as n from admin_roles
    where role = 'superadmin' and admin_id <> ${exceptAdminId ?? "00000000-0000-0000-0000-000000000000"}`;
  return n;
}

/** Invita a una persona: crea su acceso con un rol y devuelve el enlace para que elija contraseña. */
export async function inviteStaff(fd: FormData): Promise<Result> {
  await requirePermission("staff.manage");
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const name = String(fd.get("name") ?? "").trim();
  const role = String(fd.get("role") ?? "");
  const tournamentId = String(fd.get("tournament_id") ?? "") || null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Escribe un correo válido");
  if (!name) return fail("Escribe el nombre");
  if (!isRole(role)) return fail("Elige un rol");
  if (tournamentId && !UUID.test(tournamentId)) return fail("Torneo inválido");
  if (role === "superadmin" && tournamentId) return fail("El administrador general vale para todos los torneos");

  const [existing] = await sql<{ id: string }[]>`select id from admins where email = ${email}`;
  if (existing) return fail("Esa persona ya está en el equipo: agrégale el rol desde su ficha");

  const [admin] = await sql<{ id: string }[]>`
    insert into admins (email, name, password_hash) values (${email}, ${name}, ${await unusablePasswordHash()}) returning id`;
  await sql`insert into admin_roles (admin_id, role, tournament_id) values (${admin.id}, ${role}, ${tournamentId})`;
  revalidatePath("/admin/equipo");
  const link = await createActivationLink(admin.id);
  const emailed = await emailActivationLink(admin.id, link);
  return {
    ok: true,
    link,
    message: emailed
      ? "Acceso creado y enlace enviado por correo (vence en 72 horas)."
      : "Acceso creado. Envíale el enlace: vence en 72 horas.",
  };
}

export async function addRole(adminId: string, fd: FormData): Promise<Result> {
  await requirePermission("staff.manage");
  if (!UUID.test(adminId)) return fail("Miembro inválido");
  const role = String(fd.get("role") ?? "");
  const tournamentId = String(fd.get("tournament_id") ?? "") || null;
  if (!isRole(role)) return fail("Elige un rol");
  if (tournamentId && !UUID.test(tournamentId)) return fail("Torneo inválido");
  if (role === "superadmin" && tournamentId) return fail("El administrador general vale para todos los torneos");
  await sql`
    insert into admin_roles (admin_id, role, tournament_id) values (${adminId}, ${role}, ${tournamentId})
    on conflict do nothing`;
  revalidatePath("/admin/equipo");
  return { ok: true, message: "Rol agregado" };
}

export async function removeRole(roleId: string): Promise<Result> {
  await requirePermission("staff.manage");
  if (!UUID.test(roleId)) return fail("Rol inválido");
  const [r] = await sql<{ admin_id: string; role: string }[]>`select admin_id, role from admin_roles where id = ${roleId}`;
  if (!r) return fail("Rol no encontrado");
  if (r.role === "superadmin" && (await superadminCount(r.admin_id)) === 0) {
    return fail("Debe quedar al menos un administrador general");
  }
  await sql`delete from admin_roles where id = ${roleId}`;
  revalidatePath("/admin/equipo");
  return { ok: true, message: "Rol quitado" };
}

/** Quita todo acceso de una persona (su cuenta deja de servir de inmediato). */
export async function removeStaff(adminId: string): Promise<Result> {
  const me = await requirePermission("staff.manage");
  if (!UUID.test(adminId)) return fail("Miembro inválido");
  if (adminId === me.id) return fail("No puedes quitarte el acceso a ti mismo");
  if ((await superadminCount(adminId)) === 0) return fail("Debe quedar al menos un administrador general");
  await sql`delete from admins where id = ${adminId}`;
  revalidatePath("/admin/equipo");
  return { ok: true, message: "Acceso eliminado" };
}

/** Nuevo enlace para elegir contraseña (si perdió el anterior o la olvidó). */
export async function newActivationLink(adminId: string): Promise<Result> {
  await requirePermission("staff.manage");
  if (!UUID.test(adminId)) return fail("Miembro inválido");
  const [a] = await sql<{ id: string }[]>`select id from admins where id = ${adminId}`;
  if (!a) return fail("Miembro no encontrado");
  const link = await createActivationLink(a.id);
  const emailed = await emailActivationLink(a.id, link);
  return { ok: true, link, message: emailed ? "Enlace creado y enviado por correo: vence en 72 horas" : "Enlace creado: vence en 72 horas" };
}

/** Correo de prueba a la propia dirección del administrador, para comprobar la configuración. */
export async function sendTestEmail(): Promise<Result> {
  const me = await requirePermission("staff.manage");
  if (!isEmailEnabled()) return fail("Los correos todavía no están activos: falta configurar Resend");
  const r = await sendEmail({
    to: me.email,
    subject: "Correo de prueba · Torneos Vóley Playa",
    html: emailLayout("¡Funciona!", [
      "Este es un correo de prueba enviado desde el panel. Si lo recibiste, los atletas también recibirán los correos de confirmación, recuperación de contraseña e inscripciones.",
      "Si llegó a la carpeta de spam, márcalo como “No es spam”.",
    ]),
  });
  if (!r.ok) return fail(r.error);
  return { ok: true, message: `Correo enviado a ${me.email}. Revisa tu bandeja (y la carpeta de spam).` };
}
