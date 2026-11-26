import Link from "next/link";
import { redirect } from "next/navigation";
import { getAthlete } from "@/lib/athlete-auth";
import { REGISTRATION_STATUS, closesInLabel, profileIssues } from "@/lib/athletes";
import { GENDER_LABEL } from "@/lib/data";
import { formatRange } from "@/lib/format";
import { feeOf, formatSoles, getAthleteRegistrations, getOpenCategories } from "@/lib/registrations";
import { openStopsFor } from "@/lib/open-stops";
import { PageTitle } from "@/components/AdminUI";
import { RegisterForm, type WizardStop } from "./RegisterForm";

export const metadata = { title: "Inscribirme · Vóley Playa" };

export default async function InscribirmePage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const me = await getAthlete();
  if (!me) redirect("/cuenta/ingresar");
  const { categoria } = await searchParams;
  const [open, mine] = await Promise.all([getOpenCategories(), getAthleteRegistrations(me.id)]);
  const missing = profileIssues(me);

  const stops: WizardStop[] = openStopsFor(open, mine, me).map((s) => ({
    id: s.tournamentId,
    name: s.name,
    detail: [s.city, formatRange(s.startDate, s.endDate)].filter(Boolean).join(" · "),
    closes: closesInLabel(s.closesAt),
    categories: s.categories.map(({ category: c, state, spotsLeft }) => {
      const fee = feeOf(c);
      return {
        id: c.id,
        name: c.name,
        genderLabel: GENDER_LABEL[c.gender],
        fee: fee !== null ? formatSoles(fee) : null,
        paymentInstructions: fee !== null ? c.payment_instructions : null,
        spots: spotsLeft === null ? null : spotsLeft === 0 ? "Sin cupos" : `${spotsLeft} ${spotsLeft === 1 ? "cupo libre" : "cupos libres"}`,
        state: state.kind,
        note:
          state.kind === "not_for_you"
            ? state.reason
            : state.kind === "registered"
              ? REGISTRATION_STATUS[state.status].label
              : state.kind === "full"
                ? "Completa"
                : null,
        registrationId: state.kind === "registered" ? state.registrationId : null,
      };
    }),
  }));
  const anyOpen = stops.some((s) => s.categories.some((c) => c.state === "open"));

  return (
    <div className="space-y-8">
      <PageTitle back={{ href: "/cuenta", label: "Mi cuenta" }} eyebrow="Cuenta de atleta" title="Inscribirme con mi dupla">
        <p className="mt-2 max-w-2xl text-sm text-navy-500">
          Elige la categoría, busca a tu compañero/a y envía la invitación. Solo te mostramos activas las categorías que te
          corresponden por rama y edad.
        </p>
      </PageTitle>

      {missing.length > 0 ? (
        <div className="card flex flex-wrap items-center justify-between gap-4 border-sky-200 bg-sky-50/50">
          <div>
            <p className="font-semibold text-navy-900">Primero completa tu perfil</p>
            <p className="text-sm text-navy-600">Falta: {missing.join(", ")}.</p>
          </div>
          <Link href="/cuenta/perfil" className="btn-primary">
            Completar perfil
          </Link>
        </div>
      ) : stops.length === 0 ? (
        <p className="card text-center text-navy-400">No hay paradas con inscripciones abiertas en este momento.</p>
      ) : (
        <>
          {!anyOpen && (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Por ahora no hay categorías abiertas que te correspondan (ya estás inscrito/a, están completas o son de otra
              rama o edad).
            </p>
          )}
          <RegisterForm stops={stops} selected={categoria} />
        </>
      )}
    </div>
  );
}
