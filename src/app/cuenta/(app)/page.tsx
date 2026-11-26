import Link from "next/link";
import { redirect } from "next/navigation";
import { getAthlete } from "@/lib/athlete-auth";
import { ACTIVE_STATUSES, fullName, isMinor, profileIssues } from "@/lib/athletes";
import { GENDER_LABEL } from "@/lib/data";
import { formatRange } from "@/lib/format";
import { getAthleteRegistrations, getOpenCategories, missingDeclarations, paymentStatus } from "@/lib/registrations";
import { openStopsFor } from "@/lib/open-stops";
import { initials } from "@/lib/profile-stats";
import { RegistrationBadge } from "@/components/RegistrationBadge";
import { InvitationButtons } from "./RegistrationButtons";
import { OpenStops } from "./OpenStops";
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
  const withContext = (p: (typeof active)[number], ms: typeof p.record.upcoming) => ms.map((m) => ({ m, p }));
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
  const current = registrations.filter((r) => !invitations.includes(r) && ACTIVE_STATUSES.includes(r.status));
  const past = registrations.filter((r) => !invitations.includes(r) && !ACTIVE_STATUSES.includes(r.status));
  const stops = openStopsFor(open, registrations, me);

  // Pendientes del atleta: declaración jurada y pago de sus inscripciones vigentes.
  const todos = current.flatMap((r) => {
    const out: { key: string; href: string; title: string; detail: string; cta: string }[] = [];
    const where = `${r.category.tournament_name} · ${r.category.name}`;
    if (missingDeclarations(r).some((a) => a.id === me.id) && ["pending_partner", "pending_review"].includes(r.status)) {
      out.push({ key: `${r.id}-dj`, href: `/cuenta/inscripciones/${r.id}`, title: "Sube tu declaración jurada", detail: where, cta: "Subir" });
    }
    if (paymentStatus(r) === "pending") {
      out.push({ key: `${r.id}-pago`, href: `/cuenta/inscripciones/${r.id}`, title: "Paga y sube el comprobante", detail: where, cta: "Pagar" });
    }
    return out;
  });
  const pendingCount = (missing.length > 0 ? 1 : 0) + invitations.length + todos.length;

  return (
    <div className="space-y-10">
      {/* Saludo */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="grid size-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-300 via-sky-400 to-navy-500 p-[2px]"
          >
            <span className="grid size-full place-items-center rounded-full bg-navy-900 text-lg font-bold text-white">
              {initials(fullName(me) || me.email || "?")}
            </span>
          </span>
          <div>
            <p className="eyebrow">Cuenta de atleta</p>
            <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">Hola, {me.first_name || "atleta"}</h1>
            <p className="text-sm text-navy-500">
              {pendingCount > 0
                ? `Tienes ${pendingCount} ${pendingCount === 1 ? "pendiente" : "pendientes"}.`
                : stops.some((s) => s.canJoin)
                  ? "Hay paradas con inscripciones abiertas para ti."
                  : "Todo al día."}
            </p>
          </div>
        </div>
        <Link href={`/atletas/${me.id}`} className="btn">
          Mi perfil público
        </Link>
      </header>

      {/* Pendientes */}
      {pendingCount > 0 && (
        <section aria-label="Pendientes" className="space-y-3">
          {missing.length > 0 && (
            <TodoCard
              tone="sky"
              title="Completa tu perfil para poder inscribirte"
              detail={`Falta: ${missing.join(", ")}.`}
              action={
                <Link href="/cuenta/perfil" className="btn-primary shrink-0">
                  Completar perfil
                </Link>
              }
            />
          )}
          {invitations.map((r) => (
            <TodoCard
              key={r.id}
              tone="sky"
              title={`${fullName(r.athlete1)} te invitó a jugar en dupla`}
              detail={`${r.category.tournament_name} · ${r.category.name} (${GENDER_LABEL[r.category.gender]})`}
              action={<InvitationButtons registrationId={r.id} />}
            />
          ))}
          {todos.map((t) => (
            <TodoCard
              key={t.key}
              tone="amber"
              title={t.title}
              detail={t.detail}
              action={
                <Link href={t.href} className="btn-primary shrink-0">
                  {t.cta}
                </Link>
              }
            />
          ))}
        </section>
      )}

      {/* Mis partidos */}
      {(upcoming.length > 0 || recent.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-navy-900">Mis partidos</h2>
          <div className="card p-3 sm:p-4">
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
          </div>
        </section>
      )}

      {/* Paradas abiertas */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">Paradas con inscripción abierta</h2>
            <p className="text-sm text-navy-500">Elige la categoría que te corresponde e inscríbete con tu dupla.</p>
          </div>
        </div>
        <OpenStops stops={stops} />
      </section>

      {/* Mis inscripciones */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-navy-900">Mis inscripciones</h2>
        {current.length === 0 ? (
          <p className="card text-sm text-navy-400">Todavía no tienes inscripciones vigentes.</p>
        ) : (
          <ul className="space-y-3">
            {current.map((r, i) => {
              const partner = r.athlete1.id === me.id ? r.athlete2 : r.athlete1;
              return (
                <li key={r.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
                  <Link href={`/cuenta/inscripciones/${r.id}`} className="card-link flex flex-wrap items-center justify-between gap-3 py-4">
                    <span className="min-w-0">
                      <span className="block font-semibold text-navy-900">
                        {r.category.tournament_name} · {r.category.name}
                      </span>
                      <span className="text-sm text-navy-400">
                        Con {fullName(partner) || partner.email}
                        {formatRange(r.category.start_date, r.category.end_date) && ` · ${formatRange(r.category.start_date, r.category.end_date)}`}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2">
                      {paymentStatus(r) === "paid" && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 ring-inset">
                          Pagado
                        </span>
                      )}
                      {paymentStatus(r) === "submitted" && (
                        <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200 ring-inset">
                          Comprobante enviado
                        </span>
                      )}
                      <RegistrationBadge status={r.status} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {past.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-navy-500 hover:text-navy-800">
              Inscripciones anteriores ({past.length})
            </summary>
            <ul className="mt-3 space-y-2">
              {past.map((r) => (
                <li key={r.id}>
                  <Link href={`/cuenta/inscripciones/${r.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm hover:bg-white">
                    <span className="text-navy-700">
                      {r.category.tournament_name} · {r.category.name}
                    </span>
                    <RegistrationBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {isMinor(me) && (
        <p className="text-xs text-navy-400">
          Eres menor de edad: para cada inscripción tu padre, madre o apoderado debe firmar la declaración jurada y subirla en
          PDF desde la inscripción.
        </p>
      )}
    </div>
  );
}

function TodoCard({
  tone,
  title,
  detail,
  action,
}: {
  tone: "sky" | "amber";
  title: string;
  detail: string;
  action: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${tone === "amber" ? "border-amber-200 bg-amber-50/60" : "border-sky-200 bg-sky-50/60"}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${tone === "amber" ? "bg-amber-200 text-amber-900" : "bg-sky-200 text-sky-900"}`}
        >
          !
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-navy-900">{title}</p>
          <p className="text-sm text-navy-500">{detail}</p>
        </div>
      </div>
      {action}
    </div>
  );
}
