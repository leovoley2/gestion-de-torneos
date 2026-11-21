import { getAthlete } from "@/lib/athlete-auth";
import { getAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/data";
import { sql } from "@/lib/db";
import { can } from "@/lib/permissions";
import { readPrivateFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Comprobante de pago de una inscripción. Lo ven solo quienes revisan inscripciones de ESE torneo y
 * los dos atletas de la inscripción. La ruta interna del archivo nunca sale del servidor.
 */
export async function GET(_: Request, { params }: { params: Promise<{ registrationId: string }> }) {
  const { registrationId } = await params;
  const notFound = () => new Response("No encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!isUuid(registrationId)) return notFound();

  const [r] = await sql<
    { payment_file_key: string | null; payment_file_name: string | null; payment_file_type: string | null; athlete1_id: string; athlete2_id: string; tournament_id: string }[]
  >`
    select r.payment_file_key, r.payment_file_name, r.payment_file_type, r.athlete1_id, r.athlete2_id, c.tournament_id
    from registrations r join categories c on c.id = r.category_id where r.id = ${registrationId}`;
  if (!r?.payment_file_key) return notFound();

  const [admin, athlete] = await Promise.all([getAdmin(), getAthlete()]);
  const allowed =
    (admin && can(admin.grants, "registrations.review", r.tournament_id)) ||
    (athlete && (athlete.id === r.athlete1_id || athlete.id === r.athlete2_id));
  if (!allowed) return notFound();

  const body = await readPrivateFile(r.payment_file_key);
  if (!body) return notFound();
  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": r.payment_file_type ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(r.payment_file_name ?? "comprobante")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
