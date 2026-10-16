import Link from "next/link";
import { notFound } from "next/navigation";
import { GENDER_LABEL, getCategoryView } from "@/lib/data";
import { MatchRow, StageView, makeDescribe, type Helpers } from "@/components/StageView";
import { LiveRefresh } from "@/components/LiveRefresh";

export const dynamic = "force-dynamic";

const TABS = [
  ["partidos", "Partidos"],
  ["fases", "Grupos y llaves"],
  ["duplas", "Duplas"],
] as const;

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

  // Partidos: primero los programados por hora, luego el resto en orden de número.
  const matches = [...(state?.matches ?? [])]
    .filter((m) => m.status !== "cancelled")
    .sort((a, b) => {
      const ta = schedule[a.key]?.scheduled_at ?? "";
      const tb = schedule[b.key]?.scheduled_at ?? "";
      if (ta && tb && ta !== tb) return ta < tb ? -1 : 1;
      if (Boolean(ta) !== Boolean(tb)) return ta ? -1 : 1;
      return a.number - b.number;
    });

  const last = category.format?.stages.at(-1);
  const podium = last && state ? (state.placements[last.key] ?? state.placements[`${last.key}-A`]) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <LiveRefresh categoryId={category.id} />
      <Link href={`/torneos/${tournament.id}`} className="text-sm text-sky-700 hover:underline">
        ← {tournament.name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        {category.name} <span className="font-normal text-gray-500">· {GENDER_LABEL[category.gender]}</span>
      </h1>

      {category.status === "finished" && podium?.[0] && (
        <p className="mt-3 inline-block rounded-lg bg-amber-100 px-4 py-2 font-semibold text-amber-900">
          🏆 {teamName(podium[0])}
          {podium[1] && <span className="font-normal"> · 🥈 {teamName(podium[1])}</span>}
          {podium[2] && <span className="font-normal"> · 🥉 {teamName(podium[2])}</span>}
        </p>
      )}

      <nav className="mt-4 flex gap-1 border-b">
        {TABS.map(([k, label]) => (
          <Link
            key={k}
            href={`?vista=${k}`}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${vista === k ? "border-sky-600 text-sky-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        {!state || !helpers ? (
          vista !== "duplas" && <p className="text-gray-500">La programación se publicará pronto.</p>
        ) : vista === "fases" ? (
          <div className="space-y-4">
            {category.format!.stages.map((s) => (
              <StageView key={s.key} stage={s} gen={category.generated!} state={state} helpers={helpers} />
            ))}
          </div>
        ) : vista === "partidos" ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((m) => (
              <li key={m.key} className="rounded-lg border bg-white">
                <MatchRow m={m} helpers={helpers} />
              </li>
            ))}
          </ul>
        ) : null}

        {vista === "duplas" && (
          <ol className="card divide-y">
            {teams.map((t) => (
              <li key={t.id} className="flex gap-3 py-1.5 text-sm">
                <span className="w-6 text-right text-gray-500">{t.seed}</span>
                {t.player1} / {t.player2}
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
