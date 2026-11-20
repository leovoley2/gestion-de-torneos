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
import { getParticipations } from "@/lib/athlete-profile";
import { TeamMatchRow } from "@/components/TeamMatchRow";

export const metadata = { title: "Mi cuenta · Vóley Playa" };

export default async function AccountHome() {
  const me = await getAthlete();
  if (!me) redirect("/cuenta/ingresar");
  const [registrations, open, participations] = await Promise.all([
    getAthleteRegistrations(me.id),
    getOpenCategories(),
    getParticipations(me.id),
  ]);
  // Partidos de las categorías que todavía se juegan: los que faltan (por hora) y los últimos resultados.
  const active = participations.filter((p) => p.category.status !== "finished");
  const withContext = (p: (typeof active)[number], ms: typeof p.record.upcoming) =>
    ms.map((m) => ({ m, p }));
  const upcoming = active
    .flatMap((p) => withContext(p, p.record.upcoming))
    .filter(({ m }) => m.opponent !== null || m.scheduledAt)
    .sort((a, b) => (a.m.scheduledAt ?? "9999").localeCompare(b.m.scheduledAt ?? "9999"))
    .slice(0, 6);
  const recent = active
    .flatMap((p) => withContext(p, p.record.played))
    .sort((a, b) => (b.m.scheduledAt ?? "").localeCompare(a.m.scheduledAt ?? ""))
    .slice(0, 4);
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

      {(upcoming.length > 0 || recent.length > 0) && (
        <section className="card p-3 sm:p-4">
          <div className="mb-1 flex items-center justify-between gap-3 px-3 pt-1">
            <h2 className="font-semibold text-navy-900">Mis partidos</h2>
            <Link href={`/atletas/${me.id}`} className="text-sm font-medium text-sky-700 hover:text-sky-900">
              Mi perfil público →
            </Link>
          </div>
          {upcoming.length > 0 && (
            <ul>
              {upcoming.map(({ m, p }) => (
                <li key={`${p.teamId}-${m.key}`}>
                  <TeamMatchRow
                    m={m}
                    opponentName={m.opponent ? (p.names[m.opponent] ?? "—") : "Por definir"}
                    context={active.length > 1 ? p.category.name : undefined}
                    href={`/torneos/${p.tournament.id}/${p.category.id}`}
                  />
                </li>
              ))}
            </ul>
          )}
          {recent.length > 0 && (
            <>
              <h3 className="mt-3 px-3 text-xs font-semibold text-navy-400">Últimos resultados</h3>
              <ul>
                {recent.map(({ m, p }) => (
                  <li key={`${p.teamId}-${m.key}`}>
                    <TeamMatchRow
                      m={m}
                      opponentName={m.opponent ? (p.names[m.opponent] ?? "—") : "—"}
                      context={active.length > 1 ? p.category.name : undefined}
                      href={`/torneos/${p.tournament.id}/${p.category.id}`}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
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
