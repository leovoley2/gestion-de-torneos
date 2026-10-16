import type { GeneratedFormat, ResolvedMatch, Source, StageDef, TournamentState } from "@/lib/engine";

export const STATUS_STYLE: Record<ResolvedMatch["status"], string> = {
  undefined: "bg-gray-100 text-gray-500",
  ready: "bg-sky-100 text-sky-700",
  finished: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-gray-200 text-gray-500 line-through",
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

export const formatWhen = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("es-PE", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

const BRACKET_NAMES: Record<string, string> = {
  main: "Llave",
  winners: "Ganadores",
  losers: "Perdedores",
  final: "Final",
  placement: "Puestos",
  crossover: "Cruces",
  group: "Grupo",
};

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
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold">{stage.name}</h2>

      {groups.length > 0 && (
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => {
            const rows = orderedRows(g.key);
            return (
              <div key={g.key} className="overflow-hidden rounded-lg border">
                <div className="bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white">Grupo {g.name}</div>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-2 py-1 text-left">#</th>
                      <th className="px-2 py-1 text-left">Dupla</th>
                      <th className="px-1">PJ</th>
                      <th className="px-1">PG</th>
                      <th className="px-1">Pts</th>
                      <th className="px-1">Sets</th>
                      <th className="px-1">Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.teamId} className="border-t">
                        <td className="px-2 py-1">{i + 1}</td>
                        <td className="px-2 py-1">{helpers.teamName(r.teamId)}</td>
                        <td className="text-center">{r.played}</td>
                        <td className="text-center">{r.wins}</td>
                        <td className="text-center font-semibold">{r.points}</td>
                        <td className="text-center">
                          {r.setsWon}-{r.setsLost}
                        </td>
                        <td className="text-center">
                          {Number.isFinite(r.pointRatio) ? r.pointRatio.toFixed(3) : "Máx."}
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 &&
                      g.slots.map((s, i) => (
                        <tr key={i} className="border-t text-gray-500">
                          <td className="px-2 py-1">—</td>
                          <td className="px-2 py-1" colSpan={6}>
                            {helpers.describe(s)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <ul className="divide-y border-t">
                  {matches
                    .filter((m) => m.groupKey === g.key)
                    .map((m) => (
                      <li key={m.key}>
                        <MatchRow m={m} helpers={helpers} />
                      </li>
                    ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {columns.size > 0 && (
        <div className="mt-3 flex gap-4 overflow-x-auto pb-2">
          {[...columns.entries()].map(([k, ms]) => (
            <div key={k} className="w-64 shrink-0">
              <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">
                {BRACKET_NAMES[ms[0].bracket]} · R{ms[0].round}
              </h3>
              <ul className="space-y-2">
                {ms.map((m) => (
                  <li key={m.key} className="rounded-lg border">
                    <MatchRow m={m} helpers={helpers} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MatchRow({ m, helpers }: { m: ResolvedMatch; helpers: Helpers }) {
  const info = helpers.info?.(m.key);
  const when = formatWhen(info?.scheduledAt);
  const side = (id: string | null, src: Source | null, key: "a" | "b") => (
    <div className={`flex justify-between gap-2 ${m.winner && m.winner === id ? "font-bold" : ""}`}>
      <span className={id ? "" : "italic text-gray-400"}>{id ? helpers.teamName(id) : helpers.describe(src)}</span>
      <span className="tabular-nums text-gray-600">
        {m.result?.walkoverWinner
          ? m.result.walkoverWinner === id && "W.O."
          : m.result?.sets.map((s, i) => (
              <span key={i} className="ml-1.5">
                {s[key]}
              </span>
            ))}
      </span>
    </div>
  );
  return (
    <div className="px-3 py-2 text-xs">
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-gray-500">
        <span>
          P{m.number} · {m.label}
        </span>
        <span className={`shrink-0 rounded px-1.5 py-0.5 ${STATUS_STYLE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
      </div>
      {side(m.teamA, m.a, "a")}
      {side(m.teamB, m.b, "b")}
      {(when || info?.court) && (
        <div className="mt-1 text-[11px] text-gray-500">
          {[when, info?.court].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}
