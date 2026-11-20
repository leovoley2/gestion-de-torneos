import Link from "next/link";
import { notFound } from "next/navigation";
import { GENDER_LABEL } from "@/lib/data";
import { formatRange } from "@/lib/format";
import { formatPoints } from "@/lib/ranking-calc";
import { getPublicProfile, type Participation } from "@/lib/athlete-profile";
import { SiteFooter, SiteHeader } from "@/components/Brand";
import { PhaseBadge } from "@/components/PhaseBadge";
import { TeamMatchRow } from "@/components/TeamMatchRow";

// En caché como las demás páginas públicas: cada cambio de la organización la invalida
// (revalidatePath("/", "layout")); los 5 minutos son solo un respaldo.
export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  return profile ? { title: `${profile.athlete.name} · Vóley Playa` } : {};
}

const STATUS = {
  setup: { label: "Por iniciar", phase: "upcoming" },
  in_progress: { label: "En juego", phase: "live" },
  finished: { label: "Terminado", phase: "past" },
} as const;

const categoryHref = (p: Participation) => `/torneos/${p.tournament.id}/${p.category.id}`;

export default async function AthleteProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) notFound();
  const { athlete, participations, rankings } = profile;

  const wins = participations.reduce((n, p) => n + p.record.wins, 0);
  const losses = participations.reduce((n, p) => n + p.record.losses, 0);
  const positions = participations.map((p) => p.position).filter((x): x is number => x !== null);
  const best = positions.length ? Math.min(...positions) : null;
  const podiums = positions.filter((x) => x <= 3).length;
  const active = participations.filter((p) => p.category.status !== "finished" && p.record.upcoming.length > 0);

  const stats: [string, string][] = [
    ["Torneos", String(participations.length)],
    ["Partidos ganados", wins + losses > 0 ? `${wins} de ${wins + losses}` : "—"],
    ["Mejor puesto", best ? `${best}º` : "—"],
    ["Podios", String(podiums)],
  ];

  return (
    <>
      <SiteHeader>
        <p className="eyebrow text-sky-300">Atleta</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{athlete.name}</h1>
        {(athlete.club || athlete.city) && (
          <p className="mt-2 text-sky-100/80">{[athlete.club, athlete.city].filter(Boolean).join(" · ")}</p>
        )}
        <dl className="mt-6 grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/10 px-3 py-2 ring-1 ring-white/15 ring-inset">
              <dt className="text-[11px] font-medium text-sky-100/70">{label}</dt>
              <dd className="text-lg font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </SiteHeader>

      <main className="mx-auto -mt-6 max-w-4xl space-y-8 px-4 sm:px-6">
        {rankings.length > 0 && (
          <section aria-label="Ranking" className="grid gap-3 sm:grid-cols-2">
            {rankings.map((r) => (
              <Link key={r.ranking.id} href={`/ranking/${r.ranking.id}`} className="card-link flex items-center gap-4">
                <span
                  className={`grid size-12 shrink-0 place-items-center rounded-full text-lg font-bold tabular-nums ${r.rank <= 3 ? "bg-sky-400 text-navy-950" : "bg-navy-50 text-navy-700"}`}
                >
                  {r.rank}º
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-navy-900">{r.ranking.name}</span>
                  <span className="block text-sm text-navy-400">
                    {GENDER_LABEL[r.ranking.gender]} · {r.ranking.season} · de {r.total}
                  </span>
                </span>
                <span className="ml-auto text-right">
                  <span className="block text-xl font-bold text-navy-900 tabular-nums">{formatPoints(r.points)}</span>
                  <span className="block text-[11px] text-navy-400">puntos</span>
                </span>
              </Link>
            ))}
          </section>
        )}

        {active.length > 0 && (
          <section className="card p-3 sm:p-4">
            <h2 className="mb-1 px-3 pt-1 font-semibold text-navy-900">Próximos partidos</h2>
            <ul>
              {active.flatMap((p) =>
                p.record.upcoming
                  .filter((m) => m.opponent !== null || m.scheduledAt)
                  .map((m) => (
                    <li key={`${p.teamId}-${m.key}`}>
                      <TeamMatchRow
                        m={m}
                        opponentName={m.opponent ? (p.names[m.opponent] ?? "—") : "Por definir"}
                        context={`${p.tournament.name} · ${p.category.name}`}
                        href={categoryHref(p)}
                      />
                    </li>
                  )),
              )}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-3 font-semibold text-navy-900">Torneos</h2>
          {participations.length === 0 ? (
            <p className="card text-sm text-navy-400">Todavía no hay torneos publicados.</p>
          ) : (
            <ul className="space-y-3">
              {participations.map((p, i) => (
                <li key={p.teamId} className="rise" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                  <ParticipationCard p={p} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function ParticipationCard({ p }: { p: Participation }) {
  const s = STATUS[p.category.status];
  const when = formatRange(p.tournament.start_date, p.tournament.end_date);
  const medal = p.position !== null && p.position <= 3;
  return (
    <article className="card p-0">
      <div className="flex items-start gap-4 px-5 py-4">
        {p.position !== null ? (
          <span
            className={`grid size-11 shrink-0 place-items-center rounded-full text-base font-bold tabular-nums ${medal ? "bg-sky-400 text-navy-950" : "bg-navy-50 text-navy-700"}`}
            aria-label={`Puesto ${p.position}`}
          >
            {p.position}º
          </span>
        ) : (
          <PhaseBadge phase={s.phase}>{s.label}</PhaseBadge>
        )}
        <div className="min-w-0 flex-1">
          <Link href={categoryHref(p)} className="font-semibold text-navy-900 hover:text-sky-700">
            {p.tournament.name}
          </Link>
          <p className="text-sm text-navy-400">
            {[`${p.category.name} (${GENDER_LABEL[p.category.gender]})`, p.tournament.city, when].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 text-sm text-navy-600">
            Con{" "}
            {p.partner.id ? (
              <Link href={`/atletas/${p.partner.id}`} className="font-medium text-sky-700 hover:text-sky-900">
                {p.partner.name}
              </Link>
            ) : (
              <span className="font-medium">{p.partner.name}</span>
            )}
          </p>
        </div>
        {p.record.wins + p.record.losses > 0 && (
          <span className="shrink-0 text-right text-xs text-navy-400">
            <strong className="block text-sm text-navy-800 tabular-nums">
              {p.record.wins}–{p.record.losses}
            </strong>
            G–P
          </span>
        )}
      </div>
      {p.record.played.length > 0 && (
        <details className="group border-t border-navy-50">
          <summary className="cursor-pointer list-none px-5 py-2.5 text-xs font-semibold text-sky-700 hover:text-sky-900">
            <span className="group-open:hidden">Ver partidos ({p.record.played.length})</span>
            <span className="hidden group-open:inline">Ocultar partidos</span>
          </summary>
          <ul className="px-2 pb-2">
            {p.record.played.map((m) => (
              <li key={m.key}>
                <TeamMatchRow
                  m={m}
                  opponentName={m.opponent ? (p.names[m.opponent] ?? "—") : "—"}
                  href={categoryHref(p)}
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
