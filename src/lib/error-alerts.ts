import "server-only";
import { createHash } from "node:crypto";
import { sql } from "@/lib/db";
import { appUrl, emailLayout, escapeHtml, sendEmail } from "@/lib/email";

// Aviso de errores del servidor (instrumentation.ts → onRequestError).
// Cada error se agrupa por mensaje + ruta. Se avisa por correo a los administradores generales como
// máximo una vez por hora por grupo, y nunca más de MAX_EMAILS_PER_HOUR correos en total.

const NOTIFY_EVERY_MINUTES = 60;
const MAX_EMAILS_PER_HOUR = 10;

/** Errores esperados (permisos, sesión, validaciones que se muestran al usuario): no son fallas. */
const EXPECTED = [
  /^Inicia sesión/,
  /^No tienes permiso/,
  /^Solo los administradores/,
  /^Primero verifica tu correo/,
  /^Identificador inválido/,
  /^NEXT_(REDIRECT|NOT_FOUND|HTTP_ERROR_FALLBACK)/,
];

export const isExpectedError = (message: string) => EXPECTED.some((re) => re.test(message));

/** Misma falla en la misma ruta = mismo grupo (los números e ids del mensaje no cuentan). */
export function errorSignature(message: string, route: string): string {
  const normalized = message
    .slice(0, 300)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\d+/g, "<n>");
  return createHash("sha1").update(`${route}\n${normalized}`).digest("hex");
}

export interface ErrorInput {
  message: string;
  stack?: string;
  digest?: string;
  route: string; // p. ej. /torneos/[id]/[catId]
  method?: string;
  kind?: string; // render, route, action, middleware
}

/** Registra el error y, si corresponde, avisa por correo. Nunca lanza: no debe empeorar la falla. */
export async function reportServerError(e: ErrorInput): Promise<void> {
  try {
    if (isExpectedError(e.message)) return;
    const signature = errorSignature(e.message, e.route);
    const [row] = await sql<{ count: number; notify: boolean }[]>`
      insert into error_events (signature, message, route, digest)
      values (${signature}, ${e.message.slice(0, 2000)}, ${e.route}, ${e.digest ?? null})
      on conflict (signature) do update set
        count = error_events.count + 1, last_seen = now(), digest = coalesce(excluded.digest, error_events.digest)
      returning count,
        (last_notified_at is null or last_notified_at < now() - make_interval(mins => ${NOTIFY_EVERY_MINUTES})) as notify`;
    if (!row?.notify) return;
    const [{ sent }] = await sql<{ sent: number }[]>`
      select count(*)::int as sent from error_events where last_notified_at > now() - interval '1 hour'`;
    if (sent >= MAX_EMAILS_PER_HOUR) return;
    await sql`update error_events set last_notified_at = now() where signature = ${signature}`;

    const admins = await sql<{ email: string }[]>`
      select distinct a.email from admins a join admin_roles r on r.admin_id = a.id where r.role = 'superadmin'`;
    const where = `${e.method ?? ""} ${e.route}`.trim();
    for (const a of admins) {
      await sendEmail({
        to: a.email,
        subject: `⚠️ Error en la web: ${e.message.slice(0, 60)}`,
        html: emailLayout(
          "Ocurrió un error en la web",
          [
            `<strong>Dónde:</strong> ${escapeHtml(where)}${e.kind ? ` (${escapeHtml(e.kind)})` : ""}`,
            `<strong>Mensaje:</strong> ${escapeHtml(e.message.slice(0, 500))}`,
            row.count > 1 ? `Este error ya ocurrió ${row.count} veces.` : "Es la primera vez que ocurre.",
            e.digest ? `Código para buscarlo en los registros de Vercel: <code>${escapeHtml(e.digest)}</code>` : "",
            "No volveremos a avisar de este mismo error durante la próxima hora.",
          ].filter(Boolean),
          { label: "Ver errores recientes", url: `${appUrl()}/admin/sistema` },
        ),
      });
    }
  } catch (err) {
    console.error("[errores] No se pudo registrar el aviso", err);
  }
}

export interface ErrorEvent {
  signature: string;
  message: string;
  route: string | null;
  digest: string | null;
  count: number;
  first_seen: Date;
  last_seen: Date;
}

export async function recentErrors(limit = 20): Promise<ErrorEvent[]> {
  return sql<ErrorEvent[]>`
    select signature, message, route, digest, count, first_seen, last_seen from error_events
    where last_seen > now() - interval '30 days' order by last_seen desc limit ${limit}`;
}
