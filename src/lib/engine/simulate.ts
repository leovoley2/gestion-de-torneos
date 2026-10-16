import { stageRules } from "./rules";
import { resolveTournament, type TournamentState } from "./resolve";
import { seededRandom } from "./seeding";
import type { FormatDefinition, GeneratedFormat, MatchResult, MatchRules, SetScore, TeamRef } from "./types";

/** Marcador aleatorio pero válido (gana el mejor sembrado con más probabilidad). */
export function randomResult(rules: MatchRules, aStronger: boolean, random: () => number): MatchResult {
  const sets: SetScore[] = [];
  let wa = 0;
  let wb = 0;
  const maxSets = rules.setsToWin * 2 - 1;
  while (wa < rules.setsToWin && wb < rules.setsToWin) {
    const deciding = sets.length === maxSets - 1 && maxSets > 1;
    const target = deciding ? rules.decidingSetPoints : rules.setPoints;
    const aWins = random() < (aStronger ? 0.65 : 0.35);
    const extra = random() < 0.2 ? Math.floor(random() * 5) + 1 : 0;
    const win = target + extra;
    const lose = extra > 0 ? win - rules.winBy : Math.floor(random() * (target - rules.winBy));
    sets.push(aWins ? { a: win, b: lose } : { a: lose, b: win });
    if (aWins) wa++;
    else wb++;
  }
  return { sets };
}

/** Juega todo el torneo con resultados aleatorios. Devuelve resultados y estado final. */
export function simulateTournament(
  format: FormatDefinition,
  gen: GeneratedFormat,
  teams: TeamRef[],
  seed = 7,
): { results: Record<string, MatchResult>; state: TournamentState } {
  const random = seededRandom(seed);
  const seedOf = new Map(teams.map((t) => [t.id, t.seed]));
  const stages = new Map(format.stages.map((s) => [s.key, s]));
  const results: Record<string, MatchResult> = {};
  let state = resolveTournament(format, gen, teams, results);
  for (let i = 0; i < gen.matches.length + 1; i++) {
    const ready = state.matches.filter((m) => m.status === "ready");
    if (ready.length === 0) break;
    for (const m of ready) {
      const rules = stageRules(format, stages.get(m.stageKey)!).match;
      results[m.key] = randomResult(rules, seedOf.get(m.teamA!)! < seedOf.get(m.teamB!)!, random);
    }
    state = resolveTournament(format, gen, teams, results);
  }
  return { results, state };
}
