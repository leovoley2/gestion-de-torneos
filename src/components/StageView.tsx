import type { GeneratedFormat, ResolvedMatch, Source, StageDef, TournamentState } from "@/lib/engine";

export const STATUS_STYLE: Record<ResolvedMatch["status"], string> = {
  undefined: "bg-navy-50 text-navy-400 ring-navy-100",
  ready: "bg-sky-50 text-sky-700 ring-sky-200",
  finished: "bg-navy-800 text-white ring-navy-800",
  cancelled: "bg-navy-50 text-navy-300 ring-navy-100 line-through",
};
export const STATUS_LABEL: Record<ResolvedMatch["status"], string> = {
  undefined: "Por definir",
  ready: "Por jugarse",
  finished: "Finalizado",
  cancelled: "No se juega",
};

export interface MatchInfo {
  court?: string | null;
  scheduledAt?: string | null;
}

export interface Helpers {
  teamName: (id: string | null) => string;
  describe: (s: Source | null) => string;
  info?: (matchKey: string) => MatchInfo | undefined;
}

/** Texto para un lado todavía sin equipo: "1º Grupo A", "Ganador P12"… */
export function makeDescribe(gen: GeneratedFormat, teamName: (id: string | null) => string) {
  const numberOf = (key: string) => gen.matches.find((m) => m.key === key)?.number;
  return (s: Source | null): string => {
    if (!s) return "Bye";
    switch (s.type) {
      case "team":
        return teamName(s.teamId);
      case "seed":
        return `Sembrado ${s.seed}`;
      case "group_position":
        return `${s.position}º Grupo ${s.groupKey.split("-").pop()}`;
      case "match_winner":
        return `Ganador P${numberOf(s.matchKey)}`;
      case "match_loser":
        return `Perdedor P${numberOf(s.matchKey)}`;
      case "ranking_position":
        return `${s.rank}º mejor ${s.position}º`;
    }
  };
}

const TZ = "America/Lima";
export const formatWhen = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-PE", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: TZ,
      })
    : null;
const formatTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : null;

const BRACKET_NAMES: Record<string, string> = {
  main: "Llave",
  winners: "Ganadores",
  losers: "Perdedores",
  final: "Final",
  placement: "Puestos",
  crossover: "Cruces",
  group: "Grupo",
};

export function StatusPill({ status }: { status: ResolvedMatch["status"] }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-1 ring-inset ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function StageView({
  stage,
  gen,
  state,
  helpers,
}: {
  stage: StageDef;
  gen: GeneratedFormat;
  state: TournamentState;
  helpers: Helpers;
}) {
  const groups = gen.groups.filter((g) => g.stageKey === stage.key);
  const matches = state.matches.filter((m) => m.stageKey === stage.key);

  // Si el grupo ya tiene puestos definidos (pool FIVB o grupo terminado), se ordena por ellos.
  const orderedRows = (groupKey: string) => {
    const rows = state.standings[groupKey] ?? [];
    const places = state.placements[groupKey] ?? [];
    if (places.length !== rows.length || places.some((p) => !p)) return rows;
    return [...rows].sort((x, y) => places.indexOf(x.teamId) - places.indexOf(y.teamId));
  };

  // Columnas de la llave: por tramo (ganadores/perdedores/final) y ronda.
  const columns = new Map<string, ResolvedMatch[]>();
  for (const m of matches.filter((m) => !m.groupKey)) {
    const k = `${m.bracket}|${m.round}`;
    columns.set(k, [...(columns.get(k) ?? []), m]);
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-bold tracking-tight text-navy-900">{stage.name}</h2>

      {groups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const rows = orderedRows(g.key);
            return (
              <article
                key={g.key}
                className="overflow-hidden rounded-2xl border border-navy-100/70 bg-white shadow-[0_1px_2px_rgb(12_31_63/0.04),0_8px_24px_-12px_rgb(12_31_63/0.12)]"
              >
                <header className="bg-ocean flex items-center justify-between px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-white">Grupo {g.name}</h3>
                  <span className="text-[11px] font-medium text-sky-200">{g.slots.length} duplas</span>
                </header>
                <table className="w-full text-xs">
                  <thead className="text-[10px] tracking-wide text-navy-400 uppercase">
                    <tr className="border-b border-navy-50">
                      <th className="py-2 pr-1 pl-4 text-left font-semibold">#</th>
                      <th className="px-1 py-2 text-left font-semibold">Dupla</th>
                      <th className="px-1 py-2 text-center font-semibold" title="Partidos jugados">PJ</th>
                      <th className="px-1 py-2 text-center font-semibold" title="Partidos ganados">PG</th>
                      <th className="px-1 py-2 text-center font-semibold" title="Puntos">Pts</th>
                      <th className="px-1 py-2 text-center font-semibold">Sets</th>
                      <th className="py-2 pr-4 pl-1 text-right font-semibold" title="Cociente de puntos">Ratio</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {rows.map((r, i) => (
                      <tr key={r.teamId} className="border-b border-navy-50 last:border-0">
                        <td className="py-2 pr-1 pl-4">
                          <span
                            className={`grid size-5 place-items-center rounded-full text-[10px] font-bold ${i === 0 && r.played > 0 ? "bg-sky-400 text-navy-950" : "bg-navy-50 text-navy-500"}`}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-1 py-2 font-medium text-navy-900">{helpers.teamName(r.teamId)}</td>
                        <td className="px-1 text-center text-navy-500">{r.played}</td>
                        <td className="px-1 text-center text-navy-500">{r.wins}</td>
                        <td className="px-1 text-center font-bold text-navy-900">{r.points}</td>
                        <td className="px-1 text-center text-navy-500">
                          {r.setsWon}-{r.setsLost}
                        </td>
                        <td className="py-2 pr-4 pl-1 text-right text-navy-500">
                          {Number.isFinite(r.pointRatio) ? r.pointRatio.toFixed(3) : "Máx."}
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 &&
                      g.slots.map((s, i) => (
                        <tr key={i} className="border-b border-navy-50 last:border-0">
                          <td className="py-2 pr-1 pl-4 text-navy-300">—</td>
                          <td className="px-1 py-2 text-navy-400 italic" colSpan={6}>
                            {helpers.describe(s)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <ul className="divide-y divide-navy-50 border-t border-navy-100/70 bg-navy-50/40">
                  {matches
                    .filter((m) => m.groupKey === g.key)
                    .map((m) => (
                      <li key={m.key}>
                        <MatchRow m={m} helpers={helpers} />
                      </li>
                    ))}
                </ul>
              </article>
            );
          })}
        </div>
      )}

      {columns.size > 0 && (
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
          {[...columns.entries()].map(([k, ms]) => (
            <div key={k} className="w-72 shrink-0">
              <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-wider text-navy-400 uppercase">
                <span className="h-px flex-1 bg-navy-100" />
                {BRACKET_NAMES[ms[0].bracket]} · R{ms[0].round}
                <span className="h-px flex-1 bg-navy-100" />
              </h3>
              <ul className="flex flex-col justify-around gap-3">
                {ms.map((m) => (
                  <li key={m.key}>
                    <MatchCard m={m} helpers={helpers} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Lado de un partido: nombre (o de dónde viene) y puntos por set. */
function Side({ m, id, src, side, helpers }: { m: ResolvedMatch; id: string | null; src: Source | null; side: "a" | "b"; helpers: Helpers }) {
  const won = Boolean(m.winner) && m.winner === id;
  const lost = Boolean(m.winner) && m.winner !== id;
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className={`flex min-w-0 items-center gap-2 ${won ? "font-semibold text-navy-950" : lost ? "text-navy-400" : "text-navy-800"}`}
      >
        <span className={`size-1.5 shrink-0 rounded-full ${won ? "bg-sky-500" : "bg-transparent"}`} aria-hidden="true" />
        <span className={`truncate ${id ? "" : "text-navy-300 italic"}`}>{id ? helpers.teamName(id) : helpers.describe(src)}</span>
      </span>
      <span className="flex shrink-0 gap-1 tabular-nums">
        {m.result?.walkoverWinner
          ? won && <span className="text-[11px] font-semibold text-sky-700">W.O.</span>
          : m.result?.sets.map((s, i) => {
              const mine = s[side];
              const theirs = s[side === "a" ? "b" : "a"];
              return (
                <span
                  key={i}
                  className={`w-6 text-center text-[13px] ${mine > theirs ? "font-bold text-navy-950" : "text-navy-400"}`}
                >
                  {mine}
                </span>
              );
            })}
      </span>
    </div>
  );
}

/** Partido compacto (dentro de un grupo). */
export function MatchRow({ m, helpers }: { m: ResolvedMatch; helpers: Helpers }) {
  const info = helpers.info?.(m.key);
  const when = formatWhen(info?.scheduledAt);
  return (
    <div className="px-4 py-2.5 text-xs">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-navy-400">
        <span className="truncate">
          P{m.number}
          {when && ` · ${when}`}
          {info?.court && ` · ${info.court}`}
        </span>
        <StatusPill status={m.status} />
      </div>
      <div className="space-y-1">
        <Side m={m} id={m.teamA} src={m.a} side="a" helpers={helpers} />
        <Side m={m} id={m.teamB} src={m.b} side="b" helpers={helpers} />
      </div>
    </div>
  );
}

/** Tarjeta de partido (llaves y lista de partidos). */
export function MatchCard({ m, helpers }: { m: ResolvedMatch; helpers: Helpers }) {
  const info = helpers.info?.(m.key);
  const time = formatTime(info?.scheduledAt);
  return (
    <article
      className={`rounded-xl border bg-white text-sm shadow-[0_1px_2px_rgb(12_31_63/0.05)] ${m.status === "ready" ? "border-sky-200" : "border-navy-100/70"}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-navy-50 px-3.5 py-2 text-[11px] text-navy-400">
        <span className="truncate">
          <span className="font-semibold text-navy-600">P{m.number}</span> · {m.label}
        </span>
        <StatusPill status={m.status} />
      </header>
      <div className="space-y-1.5 px-3.5 py-3">
        <Side m={m} id={m.teamA} src={m.a} side="a" helpers={helpers} />
        <Side m={m} id={m.teamB} src={m.b} side="b" helpers={helpers} />
      </div>
      {(time || info?.court) && (
        <footer className="flex items-center gap-3 border-t border-navy-50 px-3.5 py-2 text-[11px] font-medium text-navy-500">
          {time && (
            <span className="flex items-center gap-1">
              <ClockIcon /> {time}
            </span>
          )}
          {info?.court && (
            <span className="flex items-center gap-1">
              <CourtIcon /> {info.court}
            </span>
          )}
        </footer>
      )}
    </article>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 text-sky-500" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.8V8l2 1.4" strokeLinecap="round" />
    </svg>
  );
}

function CourtIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5 text-sky-500" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="9" rx="1" />
      <path d="M8 3.5v9" />
    </svg>
  );
}
