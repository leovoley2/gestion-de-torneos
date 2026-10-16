import Link from "next/link";
import { notFound } from "next/navigation";
import { GENDER_LABEL, getCategoryView } from "@/lib/data";
import type { ResolvedMatch } from "@/lib/engine";
import { MatchCard, StageView, makeDescribe, type Helpers } from "@/components/StageView";
import { LiveRefresh } from "@/components/LiveRefresh";
import { SiteFooter, SiteHeader } from "@/components/Brand";

export const dynamic = "force-dynamic";

const TABS = [
  ["partidos", "Partidos"],
  ["fases", "Grupos y llaves"],
  ["duplas", "Duplas"],
] as const;

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Lima" });
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Lima" });

export default async function PublicCategory({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; catId: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  const { id, catId } = await params;
  const { vista = "partidos" } = await searchParams;
  const view = await getCategoryView(catId, { includeDrafts: false });
  if (!view || view.tournament.id !== id) notFound();
  const { category, tournament, teams, teamRefs, state, schedule } = view;

  const names = new Map(teamRefs.map((t) => [t.id, t.name]));
  const teamName = (tid: string | null) => (tid ? (names.get(tid) ?? "—") : "—");
  const helpers: Helpers | null = category.generated
    ? {
        teamName,
        describe: makeDescribe(category.generated, teamName),
        info: (k) => ({ court: schedule[k]?.court, scheduledAt: schedule[k]?.scheduled_at }),
      }
    : null;

  // Partidos: primero los programados por hora, luego el resto en orden de número; agrupados por día.
  const matches = [...(state?.matches ?? [])]
    .filter((m) => m.status !== "cancelled")
    .sort((a, b) => {
      const ta = schedule[a.key]?.scheduled_at ?? "";
      const tb = schedule[b.key]?.scheduled_at ?? "";
      if (ta && tb && ta !== tb) return ta < tb ? -1 : 1;
      if (Boolean(ta) !== Boolean(tb)) return ta ? -1 : 1;
      return a.number - b.number;
    });
  const days: { key: string; label: string; matches: ResolvedMatch[] }[] = [];
  for (const m of matches) {
    const at = schedule[m.key]?.scheduled_at;
    const key = at ? dayKey(at) : "sin-horario";
    let day = days.find((d) => d.key === key);
    if (!day) days.push((day = { key, label: at ? dayLabel(at) : "Por programar", matches: [] }));
    day.matches.push(m);
  }

  const played = state?.matches.filter((m) => m.status === "finished").length ?? 0;
  const total = state?.matches.filter((m) => m.status !== "cancelled").length ?? 0;
  const last = category.format?.stages.at(-1);
  const podium = last && state ? (state.placements[last.key] ?? state.placements[`${last.key}-A`]) : null;

  return (
    <>
      <LiveRefresh categoryId={category.id} />
      <SiteHeader>
        <Link
          href={`/torneos/${tournament.id}`}
          className="text-sm font-medium text-sky-200 transition-colors duration-150 hover:text-white"
        >
          ← {tournament.name}
        </Link>
        <p className="eyebrow mt-4 text-sky-300">{GENDER_LABEL[category.gender]}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{category.name}</h1>

        {total > 0 && (
          <div className="mt-5 max-w-sm">
            <div className="flex justify-between text-xs font-medium text-sky-100/80">
              <span>Partidos jugados</span>
              <span className="tabular-nums">
                {played} de {total}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-300 to-sky-500"
                style={{ width: `${(played / total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {category.status === "finished" && podium?.[0] && (
          <ol className="mt-6 grid max-w-2xl gap-2 sm:grid-cols-3">
            {podium.slice(0, 3).map(
              (tid, i) =>
                tid && (
                  <li
                    key={tid}
                    className={`rise rounded-xl px-4 py-3 ring-1 ring-inset ${i === 0 ? "bg-sky-300 text-navy-950 ring-sky-200" : "bg-white/10 text-white ring-white/15"}`}
                    style={{ "--i": i } as React.CSSProperties}
                  >
                    <span className="block text-[11px] font-semibold tracking-wider uppercase opacity-70">
                      {[category.gender === "F" ? "Campeonas" : "Campeones", "Segundo lugar", "Tercer lugar"][i]}
                    </span>
                    <span className="mt-0.5 block font-semibold">{teamName(tid)}</span>
                  </li>
                ),
            )}
          </ol>
        )}
      </SiteHeader>

      <main className="mx-auto -mt-5 max-w-6xl px-4 sm:px-6">
        <nav
          aria-label="Secciones"
          className="inline-flex rounded-xl border border-navy-100 bg-white p-1 shadow-[0_8px_24px_-12px_rgb(12_31_63/0.25)]"
        >
          {TABS.map(([k, label]) => (
            <Link
              key={k}
              href={`?vista=${k}`}
              aria-current={vista === k ? "page" : undefined}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors duration-150 sm:px-4 ${
                vista === k ? "bg-navy-800 text-white" : "text-navy-500 hover:bg-sky-50 hover:text-navy-800"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-6">
          {!state || !helpers ? (
            vista !== "duplas" && (
              <p className="card text-center text-navy-400">La programación se publicará pronto.</p>
            )
          ) : vista === "fases" ? (
            <div className="space-y-6">
              {category.format!.stages.map((s) => (
                <StageView key={s.key} stage={s} gen={category.generated!} state={state} helpers={helpers} />
              ))}
            </div>
          ) : vista === "partidos" ? (
            <div className="space-y-8">
              {days.map((d) => (
                <section key={d.key}>
                  <h2 className="mb-3 text-sm font-semibold text-navy-700 first-letter:uppercase">{d.label}</h2>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {d.matches.map((m, i) => (
                      <li key={m.key} className="rise" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
                        <MatchCard m={m} helpers={helpers} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}

          {vista === "duplas" && (
            <ol className="card divide-y divide-navy-50 p-0">
              {teams.map((t) => (
                <li key={t.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sky-100 text-xs font-bold text-navy-800 tabular-nums">
                    {t.seed}
                  </span>
                  <span className="font-medium text-navy-900">{t.player1}</span>
                  <span className="text-navy-200">/</span>
                  <span className="font-medium text-navy-900">{t.player2}</span>
                </li>
              ))}
              {teams.length === 0 && <li className="px-5 py-4 text-navy-400">Aún no hay duplas inscritas.</li>}
            </ol>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
