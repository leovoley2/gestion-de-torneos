import "server-only";
import { sql } from "@/lib/db";

// Envío de correos. Con RESEND_API_KEY y EMAIL_FROM configurados se envían por Resend
// (requiere un dominio propio verificado en resend.com). Sin configurar, el correo se guarda en
// la tabla email_outbox (y se muestra en la consola) para poder probar los enlaces.

export const isEmailEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

/** URL pública de la app, para armar enlaces en los correos. */
export function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Plantilla simple con la marca (tablas e estilos en línea para clientes de correo). */
export function emailLayout(title: string, paragraphs: string[], button?: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;line-height:1.55">${p}</p>`).join("");
  const cta = button
    ? `<p style="margin:22px 0"><a href="${escapeHtml(button.url)}" style="background:#132c54;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${escapeHtml(button.label)}</a></p>
       <p style="margin:0;font-size:12px;color:#4f7cba">Si el botón no funciona, copia este enlace:<br>${escapeHtml(button.url)}</p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f2f7fc;font-family:Arial,Helvetica,sans-serif;color:#071429">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
    <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden" cellpadding="0" cellspacing="0">
      <tr><td style="background:#0c1f3f;color:#fff;padding:18px 24px;font-weight:700">Vóley Playa · <span style="color:#7dd3fc">Torneos en vivo</span></td></tr>
      <tr><td style="padding:24px"><h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>${body}${cta}</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export type SendResult = { ok: true; sent: boolean } | { ok: false; error: string };

/**
 * Envía un correo. Nunca lanza error: una acción del usuario (inscribirse, aceptar una dupla…) no se
 * interrumpe porque falle un correo. Devuelve si se envió, para el correo de prueba del panel.
 */
export async function sendEmail({ to, subject, html }: { to: string | null; subject: string; html: string }): Promise<SendResult> {
  if (!to) return { ok: true, sent: false }; // ficha sin cuenta: no hay a quién escribir
  if (!isEmailEnabled()) {
    // En producción no se guarda el contenido: los enlaces de los correos sirven para entrar a una cuenta.
    const stored = process.env.NODE_ENV === "production" ? "" : html;
    await sql`insert into email_outbox (to_email, subject, html) values (${to}, ${subject}, ${stored})`;
    const link = html.match(/href="([^"]+)"/)?.[1];
    if (process.env.NODE_ENV !== "production") {
      console.info(`[correo sin enviar] Para ${to}: ${subject}${link ? ` → ${link.replace(/&amp;/g, "&")}` : ""}`);
    }
    return { ok: true, sent: false };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, html }),
    });
    if (res.ok) return { ok: true, sent: true };
    const detail = await res.text().catch(() => "");
    console.error(`[correo] Resend respondió ${res.status}: ${detail}`);
    return { ok: false, error: describeResendError(res.status, detail) };
  } catch (e) {
    console.error("[correo] No se pudo conectar con Resend", e);
    return { ok: false, error: "No se pudo conectar con el servicio de correo" };
  }
}

/** Traduce los errores habituales de Resend a qué hay que revisar. */
export function describeResendError(status: number, detail: string): string {
  let message = "";
  try {
    message = String((JSON.parse(detail) as { message?: string }).message ?? "");
  } catch {
    message = detail;
  }
  if (status === 401 || status === 403) {
    if (/domain/i.test(message)) return `El dominio del remitente no está verificado en Resend (${message})`;
    return "La clave de Resend (RESEND_API_KEY) no es válida o no tiene permiso para enviar";
  }
  if (status === 422) return `Resend rechazó el correo: revisa EMAIL_FROM (${message || "formato inválido"})`;
  if (status === 429) return "Se alcanzó el límite de envíos de Resend; intenta en un momento";
  return `Resend respondió ${status}${message ? `: ${message}` : ""}`;
}

/** Estado de la configuración de correos, para el panel (sin mostrar la clave). */
export function emailStatus() {
  const from = process.env.EMAIL_FROM ?? null;
  const problems: string[] = [];
  if (!process.env.RESEND_API_KEY) problems.push("Falta la clave de Resend (RESEND_API_KEY)");
  if (!from) problems.push("Falta el remitente (EMAIL_FROM), p. ej. Vóley Playa <torneos@tudominio.pe>");
  else if (/resend\.dev/i.test(from)) problems.push("El remitente usa resend.dev: solo llega a tu propio correo. Usa tu dominio");
  if (!process.env.APP_URL) problems.push("Falta APP_URL: los enlaces de los correos usarán la dirección de Vercel");
  return { enabled: isEmailEnabled(), from, appUrl: appUrl(), problems };
}
