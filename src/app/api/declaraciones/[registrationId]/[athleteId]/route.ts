import { getAthlete } from "@/lib/athlete-auth";
import { getAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/data";
import { sql } from "@/lib/db";
import { readPrivateFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Entrega el PDF de una declaración jurada. Solo pueden verlo los administradores y el propio
 * atleta que la subió. La ruta interna del archivo nunca sale del servidor.
 */
export async function GET(_: Request, { params }: { params: Promise<{ registrationId: string; athleteId: string }> }) {
  const { registrationId, athleteId } = await params;
  const notFound = () => new Response("No encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!isUuid(registrationId) || !isUuid(athleteId)) return notFound();

  const [admin, athlete] = await Promise.all([getAdmin(), getAthlete()]);
  if (!admin && athlete?.id !== athleteId) return notFound();

  const [d] = await sql<{ file_key: string; file_name: string }[]>`
    select file_key, file_name from declarations where registration_id = ${registrationId} and athlete_id = ${athleteId}`;
  if (!d) return notFound();
  const body = await readPrivateFile(d.file_key);
  if (!body) return notFound();

  return new Response(body as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(d.file_name)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
