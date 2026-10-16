import { stageRules } from "./rules";
import { checkMatch } from "./score";
import { computeStandings, rankRows } from "./standings";
import type {
  FormatDefinition,
  GeneratedFormat,
  MatchResult,
  ResolvedMatch,
  Source,
  StandingRow,
  TeamRef,
} from "./types";

export interface TournamentState {
  matches: ResolvedMatch[];
  standings: Record<string, StandingRow[]>; // por groupKey
  /** Equipos (ids) por puesto: por grupo y por fase de eliminación. null = aún no definido. */
  placements: Record<string, (string | null)[]>;
}

/**
 * Calcula el estado del torneo a partir del formato generado y los resultados cargados:
 * llena los equipos de cada partido según su origen, valida marcadores, arma posiciones
 * y propaga ganadores/perdedores hasta que no haya más cambios.
 */
export function resolveTournament(
  format: FormatDefinition,
  gen: GeneratedFormat,
  teams: TeamRef[],
  results: Record<string, MatchResult>,
): TournamentState {
  const bySeed = [...teams].sort((a, b) => a.seed - b.seed);
  const seeds = new Map(teams.map((t) => [t.id, t.seed]));
  const stageByKey = new Map(format.stages.map((s) => [s.key, s]));
  const matches = new Map<string, ResolvedMatch>(
    gen.matches.map((m) => [
      m.key,
      { ...m, teamA: null, teamB: null, status: "undefined", winner: null, loser: null },
    ]),
  );
  const groupMatches = (groupKey: string) =>
    [...matches.values()].filter((m) => m.groupKey === groupKey);

  const standings: Record<string, StandingRow[]> = {};
  const groupComplete = (groupKey: string) =>
    groupMatches(groupKey).every((m) => m.status === "finished" || m.status === "cancelled");

  // Posiciones finales de un grupo (solo cuando terminó; antes no se puede clasificar a nadie).
  const groupPositions = (groupKey: string): (string | null)[] | null => {
    if (gen.placements[groupKey]) return gen.placements[groupKey].map(resolveSource);
    if (!groupComplete(groupKey)) return null;
    return standings[groupKey]?.map((r) => r.teamId) ?? null;
  };

  function resolveSource(src: Source | null): string | null {
    if (!src) return null;
    switch (src.type) {
      case "team":
        return src.teamId;
      case "seed":
        return bySeed[src.seed - 1]?.id ?? null;
      case "match_winner":
        return matches.get(src.matchKey)?.winner ?? null;
      case "match_loser":
        return matches.get(src.matchKey)?.loser ?? null;
      case "group_position":
        return groupPositions(src.groupKey)?.[src.position - 1] ?? null;
      case "ranking_position": {
        const stage = stageByKey.get(src.stageKey);
        const groups = gen.groups.filter((g) => g.stageKey === src.stageKey);
        if (!stage || groups.some((g) => !groupComplete(g.key))) return null;
        const rows = groups
          .map((g) => standings[g.key]?.[src.position - 1])
          .filter((r): r is StandingRow => Boolean(r));
        const rules = stageRules(format, stage);
        // Entre grupos distintos no hay enfrentamiento directo: se usan los demás criterios.
        const criteria = rules.tiebreak.filter((c) => c !== "head_to_head");
        return rankRows(rows, criteria, [], seeds)[src.rank - 1]?.teamId ?? null;
      }
    }
  }

  const snapshot = () =>
    JSON.stringify([...matches.values()].map((m) => [m.teamA, m.teamB, m.status, m.winner]));

  for (let pass = 0; pass < gen.matches.length + 2; pass++) {
    const before = snapshot();

    // 1) Posiciones de grupos con los partidos ya resueltos.
    for (const g of gen.groups) {
      const stage = stageByKey.get(g.stageKey)!;
      const teamIds = g.slots.map(resolveSource).filter((id): id is string => Boolean(id));
      standings[g.key] = computeStandings(teamIds, groupMatches(g.key), stageRules(format, stage), seeds);
    }

    // 2) Equipos y resultado de cada partido.
    for (const m of matches.values()) {
      const stage = stageByKey.get(m.stageKey)!;
      m.teamA = resolveSource(m.a);
      m.teamB = resolveSource(m.b);
      m.winner = null;
      m.loser = null;
      m.errors = undefined;
      m.result = results[m.key];

      if (!m.teamA || !m.teamB) {
        m.status = "undefined";
        continue;
      }

      // Final de desempate: no se juega si la gran final la ganó quien venía invicto.
      if (m.conditional && m.a?.type === "match_winner") {
        const parent = matches.get(m.a.matchKey);
        if (parent?.status === "finished" && parent.winner === parent.teamA) {
          m.status = "cancelled";
          m.winner = m.teamA;
          m.loser = m.teamB;
          continue;
        }
      }

      const result = m.result;
      if (!result) {
        m.status = "ready";
        continue;
      }
      if (result.walkoverWinner) {
        const aWins = result.walkoverWinner === m.teamA;
        m.status = "finished";
        m.winner = aWins ? m.teamA : m.teamB;
        m.loser = aWins ? m.teamB : m.teamA;
        continue;
      }
      const check = checkMatch(result.sets, stageRules(format, stage).match);
      if (!check.ok) {
        m.status = "ready";
        m.errors = check.errors;
        continue;
      }
      m.status = "finished";
      m.winner = check.winner === "a" ? m.teamA : m.teamB;
      m.loser = check.winner === "a" ? m.teamB : m.teamA;
    }

    if (snapshot() === before && pass > 0) break;
  }

  const placements: Record<string, (string | null)[]> = {};
  for (const g of gen.groups) placements[g.key] = groupPositions(g.key) ?? [];
  for (const [key, sources] of Object.entries(gen.placements)) {
    placements[key] = sources.map(resolveSource);
  }

  return { matches: [...matches.values()], standings, placements };
}
