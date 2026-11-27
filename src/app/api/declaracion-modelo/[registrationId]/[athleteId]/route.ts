import { getAthlete } from "@/lib/athlete-auth";
import { getAdmin } from "@/lib/auth";
import { ageOn, fullName, isMinor, todayLima } from "@/lib/athletes";
import { GENDER_LABEL, isUuid } from "@/lib/data";
import { declarationPdf } from "@/lib/declaration-pdf";
import { formatRange } from "@/lib/format";
import { RESPONSIBLE } from "@/lib/legal";
import { can } from "@/lib/permissions";
import { getRegistration } from "@/lib/registrations";

export const dynamic = "force-dynamic";

const DOC = { DNI: "DNI", CE: "C.E.", PASAPORTE: "Pasaporte" } as const;
const date = (d: string) => {
  const [y, m, dd] = d.slice(0, 10).split("-");
  return `${dd}/${m}/${y}`;
};

/**
 * Declaración jurada del menor, ya llenada con sus datos, los de su apoderado y los del torneo.
 * La descarga el propio menor (o quien revisa inscripciones de ese torneo): contiene datos personales.
 */
export async function GET(_: Request, { params }: { params: Promise<{ registrationId: string; athleteId: string }> }) {
  const { registrationId, athleteId } = await params;
  const notFound = () => new Response("No encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!isUuid(registrationId) || !isUuid(athleteId)) return notFound();
  const reg = await getRegistration(registrationId);
  if (!reg) return notFound();
  const minor = [reg.athlete1, reg.athlete2].find((a) => a.id === athleteId);
  if (!minor) return notFound();

  const [admin, athlete] = await Promise.all([getAdmin(), getAthlete()]);
  const allowed = athlete?.id === athleteId || (admin && can(admin.grants, "registrations.review", reg.category.tournament_id));
  if (!allowed) return notFound();
  const c = reg.category;
  if (!isMinor(minor, c.start_date)) return new Response("Solo se pide a menores de edad", { status: 400 });

  const pdf = await declarationPdf({
    minor: {
      name: fullName(minor),
      document: minor.document_number ? `${DOC[minor.document_type]} ${minor.document_number}` : "",
      birthdate: minor.birthdate ? date(minor.birthdate) : "",
      age: minor.birthdate ? ageOn(minor.birthdate, c.start_date ?? todayLima()) : null,
      club: minor.club,
    },
    guardian: {
      name: minor.guardian_name ?? "",
      document: minor.guardian_document ? `DNI ${minor.guardian_document}` : "",
      relationship: minor.guardian_relationship ?? "",
      phone: minor.guardian_phone ?? "",
    },
    tournament: {
      name: c.tournament_name,
      category: `${c.name} (${GENDER_LABEL[c.gender]})`,
      dates: formatRange(c.start_date, c.end_date) ?? "",
      city: c.tournament_city ?? "",
    },
    organizer: RESPONSIBLE.name,
    reference: reg.id.slice(0, 8).toUpperCase(),
    site: RESPONSIBLE.site,
  });
  const file = `declaracion-jurada-${fullName(minor).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").toLowerCase()}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${file}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
