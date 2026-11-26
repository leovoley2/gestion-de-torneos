import Link from "next/link";
import { notFound } from "next/navigation";
import { GENDER_LABEL } from "@/lib/data";
import { formatRange } from "@/lib/format";
import { formatPoints } from "@/lib/ranking-calc";
import { getPublicProfile, type Participation } from "@/lib/athlete-profile";
import { byYear, initials, profileStats } from "@/lib/profile-stats";
import { whenLabel } from "@/components/TeamMatchRow";
import { SiteFooter, SiteHeader } from "@/components/Brand";
import { ShareButton } from "./ShareButton";

// En caché como las demás páginas públicas: cada cambio de la organización o del propio atleta la
// invalida; los 5 minutos son solo un respaldo.
export const revalidate = 300;
export const dynamicParams = true;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) return {};
  const { athlete, rankings } = profile;
  const top = [...rankings].sort((a, b) => a.rank - b.rank)[0];
  return {
    title: `${athlete.name} · Vóley Playa`,
    description: top
      ? `${athlete.name}: ${top.rank}º en ${top.ranking.name} ${top.ranking.season} con ${formatPoints(top.points)} puntos.`
      : `Torneos y resultados de ${athlete.name} en el circuito de vóley playa.`,
  };
}

const categoryHref = (p: Participation) => `/torneos/${p.tournament.id}/${p.category.id}`;
const shortDate = (d: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString("es-PE", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "") : "—";

export default async function AthleteProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getPublicProfile(id);
  if (!profile) notFound();
  const { athlete, participations, rankings } = profile;
  const stats = profileStats(participations);
  const ranked = [...rankings].sort((a, b) => a.rank - b.rank || b.points - a.points);
  const top = ranked[0];
  const upcoming = participations
    .filter((p) => p.category.status !== "finished")
    .flatMap((p) => p.record.upcoming.filter((m) => m.opponent !== null || m.scheduledAt).map((m) => ({ m, p })))
    .sort((a, b) => (a.m.scheduledAt ?? "9999").localeCompare(b.m.scheduledAt ?? "9999"));
  const next = upcoming[0];
  const champion = athlete.gender === "M" ? "Campeón" : athlete.gender === "F" ? "Campeona" : "Campeón/a";
  const pct = stats.winRate === null ? null : Math.round(stats.winRate * 100);

  return (
    <>
      <SiteHeader>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-5">
            <Avatar name={athlete.name} />
            <div className="min-w-0">
              <p className="eyebrow text-sky-300">Atleta</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{athlete.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {athlete.club && <Chip icon="club">{athlete.club}</Chip>}
                {athlete.city && <Chip icon="pin">{athlete.city}</Chip>}
                {stats.medals.gold > 0 && (
                  <Chip icon="trophy">
                    {stats.medals.gold === 1 ? champion : `${champion} ×${stats.medals.gold}`}
                  </Chip>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-4 lg:items-end">
            {top && (
              <Link
                href={`/ranking/${top.ranking.id}`}
                className="group flex items-center gap-4 rounded-2xl bg-white/10 py-3 pr-5 pl-3 ring-1 ring-white/15 backdrop-blur-sm transition-colors duration-150 ring-inset hover:bg-white/15"
              >
                <span className="grid size-14 place-items-center rounded-xl bg-gradient-to-br from-sky-300 to-sky-500 text-2xl font-bold text-navy-950 tabular-nums shadow-[0_8px_20px_-8px_rgb(56_189_248/0.8)]">
                  {top.rank}º
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{top.ranking.name}</span>
                  <span className="block text-xs text-sky-100/80">
                    Temporada {top.ranking.season} · {formatPoints(top.points)} pts · de {top.total}
                  </span>
                </span>
              </Link>
            )}
            <ShareButton name={athlete.name} />
          </div>
        </div>
      </SiteHeader>

      <main className="mx-auto -mt-8 max-w-5xl space-y-8 px-4 sm:px-6">
        {/* Resumen */}
        <section aria-label="Resumen" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Torneos" value={String(stats.tournaments)} hint={stats.tournaments === 1 ? "jugado" : "jugados"} />
          <div className="card flex items-center gap-3 px-4 py-4">
            <WinRing value={stats.winRate} />
            <div>
              <p className="text-[11px] font-medium text-navy-400">Partidos ganados</p>
              <p className="text-xl font-bold text-navy-900 tabular-nums">{pct === null ? "—" : `${pct}%`}</p>
              <p className="text-[11px] text-navy-400 tabular-nums">
                {stats.wins} G · {stats.losses} P
              </p>
            </div>
          </div>
          <Stat
            label="Mejor puesto"
            value={stats.best ? `${stats.best}º` : "—"}
            hint={stats.best === 1 ? champion.toLowerCase() : stats.best ? "lugar" : "sin terminar aún"}
          />
          <div className="card px-4 py-4">
            <p className="text-[11px] font-medium text-navy-400">Podios</p>
            <div className="mt-1.5 flex items-center gap-3">
              {(["gold", "silver", "bronze"] as const).map((k, i) => (
                <span key={k} className="flex items-center gap-1" title={["1er lugar", "2º lugar", "3er lugar"][i]}>
                  <MedalDot place={(i + 1) as 1 | 2 | 3} />
                  <span className={`text-lg font-bold tabular-nums ${stats.medals[k] ? "text-navy-900" : "text-navy-200"}`}>
                    {stats.medals[k]}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0 space-y-8">
            {next && (
              <section className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgb(12_31_63/0.05),0_12px_32px_-16px_rgb(12_31_63/0.25)] ring-1 ring-sky-200">
                <div className="flex items-center justify-between gap-3 bg-sky-50 px-5 py-2.5">
                  <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-sky-800 uppercase">
                    <span className="relative flex size-2" aria-hidden="true">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-sky-500 opacity-50 motion-reduce:animate-none" />
                      <span className="relative inline-flex size-2 rounded-full bg-sky-500" />
                    </span>
                    Próximo partido
                  </p>
                  <span className="text-xs font-semibold text-navy-700">{whenLabel(next.m.scheduledAt) ?? "Por programar"}</span>
                </div>
                <Link href={categoryHref(next.p)} className="block px-5 py-4 transition-colors duration-150 hover:bg-sky-50/40">
                  <p className="text-lg font-semibold text-navy-900">
                    vs {next.m.opponent ? (next.p.names[next.m.opponent] ?? "—") : "Por definir"}
                  </p>
                  <p className="mt-0.5 text-sm text-navy-500">
                    {[
                      next.p.tournament.name,
                      next.p.category.name,
                      `P${next.m.number} · ${next.m.label}`,
                      next.m.court ? (/^\d+$/.test(next.m.court) ? `Cancha ${next.m.court}` : next.m.court) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {upcoming.length > 1 && (
                    <p className="mt-2 text-xs font-medium text-sky-700">
                      y {upcoming.length - 1} {upcoming.length === 2 ? "partido más" : "partidos más"} por jugar →
                    </p>
                  )}
                </Link>
              </section>
            )}

            <section>
              <div className="mb-4 flex items-end justify-between gap-3">
                <h2 className="text-lg font-semibold text-navy-900">Trayectoria</h2>
                {stats.form.length > 0 && <Form results={stats.form} />}
              </div>
              {participations.length === 0 ? (
                <p className="card text-sm text-navy-400">Todavía no hay torneos publicados.</p>
              ) : (
                <div className="space-y-8">
                  {byYear(participations).map((g) => (
                    <div key={g.year}>
                      <p className="mb-3 text-xs font-semibold tracking-[0.14em] text-navy-400 uppercase">{g.year}</p>
                      <ol className="relative space-y-3 border-l border-navy-100 pl-6">
                        {g.items.map((p) => (
                          <TimelineItem key={p.teamId} p={p} champion={champion} />
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            {ranked.length > 0 && (
              <section className="card space-y-3">
                <h2 className="font-semibold text-navy-900">Ranking</h2>
                <ul className="space-y-2">
                  {ranked.map((r) => (
                    <li key={r.ranking.id}>
                      <Link
                        href={`/ranking/${r.ranking.id}`}
                        className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-150 hover:bg-sky-50"
                      >
                        <span
                          className={`grid size-10 shrink-0 place-items-center rounded-lg text-sm font-bold tabular-nums ${r.rank <= 3 ? "bg-sky-400 text-navy-950" : "bg-navy-50 text-navy-700"}`}
                        >
                          {r.rank}º
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-snug font-semibold text-navy-900">{r.ranking.name}</span>
                          <span className="block text-xs text-navy-400">
                            {GENDER_LABEL[r.ranking.gender]} · {r.ranking.season} · de {r.total}
                          </span>
                        </span>
                        <span className="text-right text-sm font-bold text-navy-900 tabular-nums">
                          {formatPoints(r.points)}
                          <span className="block text-[10px] font-medium text-navy-400">pts</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {stats.partners.length > 0 && (
              <section className="card space-y-3">
                <h2 className="font-semibold text-navy-900">Parejas</h2>
                <ul className="space-y-2.5">
                  {stats.partners.slice(0, 5).map((pt) => (
                    <li key={pt.id ?? pt.name} className="flex items-center gap-3">
                      <Avatar name={pt.name} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {pt.id ? (
                          <Link href={`/atletas/${pt.id}`} className="font-medium text-navy-900 hover:text-sky-700">
                            {pt.name}
                          </Link>
                        ) : (
                          <span className="font-medium text-navy-900">{pt.name}</span>
                        )}
                      </span>
                      <span className="text-xs text-navy-400 tabular-nums">
                        {pt.count} {pt.count === 1 ? "torneo" : "torneos"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

// ───────── Piezas ─────────

function Avatar({ name, size = "lg" }: { name: string; size?: "lg" | "sm" }) {
  return size === "lg" ? (
    <span
      aria-hidden="true"
      className="grid size-20 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-300 via-sky-400 to-navy-500 p-[3px] shadow-[0_12px_32px_-12px_rgb(56_189_248/0.7)] sm:size-24"
    >
      <span className="grid size-full place-items-center rounded-full bg-navy-900 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        {initials(name)}
      </span>
    </span>
  ) : (
    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-50 text-[11px] font-bold text-navy-700 ring-1 ring-navy-100">
      {initials(name)}
    </span>
  );
}

function Chip({ icon, children }: { icon: "club" | "pin" | "trophy"; children: React.ReactNode }) {
  const paths = {
    club: <path d="M8 1.8 2.8 4v3.6c0 3 2.2 5.6 5.2 6.6 3-1 5.2-3.6 5.2-6.6V4L8 1.8Z" strokeLinejoin="round" />,
    pin: (
      <>
        <path d="M8 14.2s4.6-4.2 4.6-7.8a4.6 4.6 0 1 0-9.2 0c0 3.6 4.6 7.8 4.6 7.8Z" strokeLinejoin="round" />
        <circle cx="8" cy="6.4" r="1.6" />
      </>
    ),
    trophy: (
      <>
        <path d="M5 2.5h6v3.5a3 3 0 0 1-6 0V2.5Z" strokeLinejoin="round" />
        <path d="M5 4H3a2 2 0 0 0 2 2.5M11 4h2a2 2 0 0 1-2 2.5M8 9v3M5.5 13.5h5" strokeLinecap="round" />
      </>
    ),
  };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-sky-50 ring-1 ring-white/15 ring-inset">
      <svg viewBox="0 0 16 16" className="size-3.5 text-sky-300" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        {paths[icon]}
      </svg>
      {children}
    </span>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card px-4 py-4">
      <p className="text-[11px] font-medium text-navy-400">{label}</p>
      <p className="mt-0.5 text-2xl font-bold text-navy-900 tabular-nums">{value}</p>
      <p className="text-[11px] text-navy-400">{hint}</p>
    </div>
  );
}

/** Anillo de porcentaje de partidos ganados. */
function WinRing({ value }: { value: number | null }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="size-12 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#eef4fb" strokeWidth="5" />
      {value !== null && value > 0 && (
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="#0ea5e9"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${c * value} ${c}`}
        />
      )}
    </svg>
  );
}

const MEDAL = {
  1: "from-amber-200 via-amber-300 to-amber-500 text-amber-950 ring-amber-300",
  2: "from-slate-100 via-slate-200 to-slate-400 text-slate-800 ring-slate-300",
  3: "from-orange-200 via-orange-300 to-orange-500 text-orange-950 ring-orange-300",
} as const;

function MedalDot({ place }: { place: 1 | 2 | 3 }) {
  return <span aria-hidden="true" className={`inline-block size-3.5 rounded-full bg-gradient-to-br ring-1 ring-inset ${MEDAL[place]}`} />;
}

/** Puesto final: medalla para el podio, círculo neutro para el resto, estado si no terminó. */
function PlaceBadge({ p }: { p: Participation }) {
  const place = p.position;
  if (place === null) {
    const live = p.category.status === "in_progress";
    return (
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${live ? "bg-sky-100 text-sky-800 ring-1 ring-sky-200" : "bg-navy-50 text-navy-500 ring-1 ring-navy-100"}`}
      >
        {live ? "EN JUEGO" : "PRÓX."}
      </span>
    );
  }
  const medal = place <= 3 ? MEDAL[place as 1 | 2 | 3] : null;
  return (
    <span
      aria-label={`Puesto ${place}`}
      className={`grid size-11 shrink-0 place-items-center rounded-full text-base font-bold tabular-nums ${
        medal ? `bg-gradient-to-br ring-1 ring-inset ${medal} shadow-[0_6px_14px_-8px_rgb(12_31_63/0.6)]` : "bg-navy-50 text-navy-700 ring-1 ring-navy-100"
      }`}
    >
      {place}º
    </span>
  );
}

function TimelineItem({ p, champion }: { p: Participation; champion: string }) {
  const played = p.record.wins + p.record.losses;
  const share = played ? (p.record.wins / played) * 100 : 0;
  return (
    <li className="relative">
      {/* Punto de la línea de tiempo */}
      <span aria-hidden="true" className="absolute top-6 -left-[29px] size-2.5 rounded-full bg-white ring-2 ring-sky-400" />
      <article className="card p-0 transition-shadow duration-200 hover:shadow-[0_1px_2px_rgb(12_31_63/0.05),0_12px_28px_-14px_rgb(12_31_63/0.25)]">
        <div className="flex items-start gap-4 px-4 py-4 sm:px-5">
          <PlaceBadge p={p} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <Link href={categoryHref(p)} className="font-semibold text-navy-900 hover:text-sky-700">
                {p.tournament.name}
              </Link>
              <span className="text-xs text-navy-400">{shortDate(p.tournament.start_date)}</span>
            </div>
            <p className="text-sm text-navy-500">
              {[`${p.category.name} (${GENDER_LABEL[p.category.gender]})`, p.tournament.city, formatRange(p.tournament.start_date, p.tournament.end_date)]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {p.position === 1 && <p className="mt-1 text-xs font-semibold text-amber-700">🏆 {champion}</p>}
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-2 text-sm text-navy-600">
                <Avatar name={p.partner.name} size="sm" />
                {p.partner.id ? (
                  <Link href={`/atletas/${p.partner.id}`} className="font-medium text-sky-700 hover:text-sky-900">
                    {p.partner.name}
                  </Link>
                ) : (
                  <span className="font-medium">{p.partner.name}</span>
                )}
              </span>
              {played > 0 && (
                <span className="flex items-center gap-2 text-xs text-navy-500">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-navy-100" aria-hidden="true">
                    <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${share}%` }} />
                  </span>
                  <span className="tabular-nums">
                    {p.record.wins} G · {p.record.losses} P
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
        {p.record.played.length > 0 && (
          <details className="group border-t border-navy-50">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-2.5 text-xs font-semibold text-sky-700 hover:text-sky-900">
              <span>Partidos ({p.record.played.length})</span>
              <svg viewBox="0 0 16 16" className="size-3.5 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <ul className="divide-y divide-navy-50 px-5 pb-2">
              {p.record.played.map((m) => (
                <li key={m.key} className="flex items-center gap-3 py-2 text-sm">
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-md text-[11px] font-bold ${m.won ? "bg-emerald-100 text-emerald-800" : "bg-navy-100 text-navy-600"}`}
                  >
                    {m.won ? "G" : "P"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-navy-800">
                    vs {m.opponent ? (p.names[m.opponent] ?? "—") : "—"}
                    <span className="ml-1.5 text-xs text-navy-400">{m.label}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-navy-700 tabular-nums">{m.walkover ? "W.O." : m.score}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </article>
    </li>
  );
}

/** Últimos resultados (el más reciente a la izquierda). */
function Form({ results }: { results: boolean[] }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Últimos partidos: ${results.map((w) => (w ? "ganado" : "perdido")).join(", ")}`}>
      <span className="text-[11px] font-medium text-navy-400">Últimos</span>
      <span className="flex gap-1">
        {results.map((won, i) => (
          <span
            key={i}
            className={`grid size-6 place-items-center rounded-md text-[11px] font-bold ${won ? "bg-emerald-500 text-white" : "bg-navy-200 text-navy-700"}`}
          >
            {won ? "G" : "P"}
          </span>
        ))}
      </span>
    </div>
  );
}
