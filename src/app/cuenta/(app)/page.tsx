import Link from "next/link";
import { redirect } from "next/navigation";
import { getAthlete } from "@/lib/athlete-auth";
import { fullName, isMinor, profileIssues } from "@/lib/athletes";
import { GENDER_LABEL } from "@/lib/data";
import { formatRange } from "@/lib/format";
import { getAthleteRegistrations, getOpenCategories, missingDeclarations } from "@/lib/registrations";
import { PageTitle } from "@/components/AdminUI";
import { RegistrationBadge } from "@/components/RegistrationBadge";
import { InvitationButtons } from "./RegistrationButtons";

export const metadata = { title: "Mi cuenta · Vóley Playa" };

export default async function AccountHome() {
  const me = await getAthlete();
  if (!me) redirect("/cuenta/ingresar");
  const [registrations, open] = await Promise.all([getAthleteRegistrations(me.id), getOpenCategories()]);
  const missing = profileIssues(me);
  const invitations = registrations.filter((r) => r.status === "pending_partner" && r.athlete2.id === me.id);
  const others = registrations.filter((r) => !invitations.includes(r));

  return (
    <div className="space-y-8">
      <PageTitle eyebrow="Cuenta de atleta" title={`Hola, ${me.first_name || "atleta"}`} />

      {missing.length > 0 && (
        <section className="card flex flex-wrap items-center justify-between gap-4 border-sky-200 bg-sky-50/40">
          <div>
            <h2 className="font-semibold text-navy-900">Completa tu perfil</h2>
            <p className="mt-0.5 text-sm text-navy-500">Para inscribirte falta: {missing.join(", ")}.</p>
          </div>
          <Link href="/cuenta/perfil" className="btn-primary">
            Completar perfil
          </Link>
        </section>
      )}

      {invitations.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold text-navy-900">Invitaciones de dupla</h2>
          <ul className="space-y-3">
            {invitations.map((r) => (
              <li key={r.id} className="card rise flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-navy-900">
                    {fullName(r.athlete1)} te invitó a jugar juntos
                  </p>
                  <p className="text-sm text-navy-400">
                    {r.category.tournament_name} · {r.category.name} ({GENDER_LABEL[r.category.gender]})
                  </p>
                </div>
                <InvitationButtons registrationId={r.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-navy-900">Mis inscripciones</h2>
          <Link href="/cuenta/inscribirme" className="btn">
            Nueva inscripción
          </Link>
        </div>
        <ul className="space-y-3">
          {others.map((r, i) => {
            const partner = r.athlete1.id === me.id ? r.athlete2 : r.athlete1;
            const needsDeclaration = missingDeclarations(r).some((a) => a.id === me.id) && ["pending_partner", "pending_review"].includes(r.status);
            return (
              <li key={r.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
                <Link href={`/cuenta/inscripciones/${r.id}`} className="card-link flex flex-wrap items-center justify-between gap-3 py-4">
                  <span>
                    <span className="block font-semibold text-navy-900">
                      {r.category.tournament_name} · {r.category.name}
                    </span>
                    <span className="text-sm text-navy-400">
                      Con {fullName(partner) || partner.email}
                      {formatRange(r.category.start_date, r.category.end_date) && ` · ${formatRange(r.category.start_date, r.category.end_date)}`}
                    </span>
                    {needsDeclaration && (
                      <span className="mt-1 block text-xs font-semibold text-amber-700">Falta subir tu declaración jurada</span>
                    )}
                  </span>
                  <RegistrationBadge status={r.status} />
                </Link>
              </li>
            );
          })}
          {others.length === 0 && (
            <li className="card text-sm text-navy-400">
              Todavía no tienes inscripciones.{" "}
              {open.length > 0 ? (
                <Link href="/cuenta/inscribirme" className="font-semibold text-sky-600">
                  Hay {open.length} {open.length === 1 ? "categoría abierta" : "categorías abiertas"} →
                </Link>
              ) : (
                "Cuando abran las inscripciones aparecerán aquí."
              )}
            </li>
          )}
        </ul>
      </section>

      {isMinor(me) && (
        <p className="text-xs text-navy-400">
          Eres menor de edad: para cada inscripción tu padre, madre o apoderado debe firmar la declaración jurada y subirla
          en PDF desde la inscripción.
        </p>
      )}
    </div>
  );
}
