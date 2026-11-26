import Link from "next/link";
import { redirect } from "next/navigation";
import { getAthlete } from "@/lib/athlete-auth";
import { profileIssues } from "@/lib/athletes";
import { GENDER_LABEL } from "@/lib/data";
import { formatRange } from "@/lib/format";
import { feeOf, formatSoles, getOpenCategories, type RegCategory } from "@/lib/registrations";
import { PageTitle } from "@/components/AdminUI";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Inscribirme · Vóley Playa" };

const deadline = (d: RegCategory["registration_deadline"]) =>
  d ? new Date(d).toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" }) : null;

export default async function InscribirmePage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const me = await getAthlete();
  if (!me) redirect("/cuenta/ingresar");
  const { categoria } = await searchParams;
  const open = await getOpenCategories();
  const missing = profileIssues(me);

  const options = open.map((c) => {
    const rules = [
      GENDER_LABEL[c.gender],
      feeOf(c) !== null && `inscripción ${formatSoles(feeOf(c)!)} por dupla`,
      c.min_birth_year && `nacidos desde ${c.min_birth_year}`,
      c.max_birth_year && `nacidos hasta ${c.max_birth_year}`,
      c.max_teams && `${Math.max(c.max_teams - c.accepted, 0)} cupos libres de ${c.max_teams}`,
      deadline(c.registration_deadline) && `cierra ${deadline(c.registration_deadline)}`,
    ].filter(Boolean);
    return {
      id: c.id,
      title: `${c.tournament_name} · ${c.name}`,
      detail: [c.tournament_city, formatRange(c.start_date, c.end_date)].filter(Boolean).join(" · "),
      rules: rules.join(" · "),
      full: Boolean(c.max_teams && c.accepted >= c.max_teams),
      fee: feeOf(c) !== null ? formatSoles(feeOf(c)!) : null,
      paymentInstructions: feeOf(c) !== null ? c.payment_instructions : null,
    };
  });

  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Cuenta de atleta" title="Inscribirme con mi dupla">
        <p className="mt-2 text-sm text-navy-400">
          Elige la categoría y escribe el correo o documento de tu compañero (debe tener su cuenta). Tu compañero
          confirma desde su cuenta y luego la organización revisa la inscripción.
        </p>
      </PageTitle>

      {missing.length > 0 ? (
        <div className="card flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-navy-600">Antes de inscribirte completa tu perfil: falta {missing.join(", ")}.</p>
          <Link href="/cuenta/perfil" className="btn-primary">
            Completar perfil
          </Link>
        </div>
      ) : options.length === 0 ? (
        <p className="card text-center text-navy-400">No hay categorías con inscripciones abiertas en este momento.</p>
      ) : (
        <RegisterForm options={options} selected={categoria} />
      )}
    </div>
  );
}
