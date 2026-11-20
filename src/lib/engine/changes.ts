import { FIVB_RULES, stageRules } from "./rules";
import { resolveTournament } from "./resolve";
import { checkMatch } from "./score";
import type { FormatDefinition, GeneratedFormat, MatchResult, MatchRules, TeamRef } from "./types";

export interface TournamentSetup {
  format: FormatDefinition;
  gen: GeneratedFormat;
  teams: TeamRef[];
}

const score = (r: MatchResult) =>
  r.walkoverWinner ? "W.O." : r.sets.map((s) => `${s.a}-${s.b}`).join(", ");

/**
 * ¿Qué resultados ya cargados dejarían de ser válidos con el cambio (formato o duplas)?
 * Un cambio es seguro si cada partido con resultado:
 *  - sigue existiendo,
 *  - lo juegan las mismas dos duplas,
 *  - y su marcador cumple las reglas de la fase (1 set, mejor de 3…).
 * Devuelve mensajes en español; vacío = el cambio conserva todos los resultados.
 */
export function resultConflicts(before: TournamentSetup, after: TournamentSetup, results: Record<string, MatchResult>): string[] {
  const keys = Object.keys(results);
  if (keys.length === 0) return [];
  const oldState = resolveTournament(before.format, before.gen, before.teams, results);
  const newState = resolveTournament(after.format, after.gen, after.teams, results);
  const oldByKey = new Map(oldState.matches.map((m) => [m.key, m]));
  const newByKey = new Map(newState.matches.map((m) => [m.key, m]));
  const issues: string[] = [];
  const consequences: string[] = [];

  for (const key of keys) {
    const old = oldByKey.get(key);
    if (!old) continue; // resultado huérfano de un formato anterior: no cuenta
    const label = `P${old.number} (${old.label}, ${score(results[key])})`;
    const now = newByKey.get(key);
    if (!now) {
      issues.push(`${label}: ese partido no existe en el nuevo formato`);
      continue;
    }
    const samePair =
      (now.teamA === old.teamA && now.teamB === old.teamB) || (now.teamA === old.teamB && now.teamB === old.teamA);
    if (!samePair) {
      consequences.push(`${label}: con el cambio lo jugarían otras duplas`);
      continue;
    }
    if (!results[key].walkoverWinner) {
      const stage = after.format.stages.find((s) => s.key === now.stageKey);
      if (stage) {
        const rules = stageRules(after.format, stage).match;
        const check = checkMatch(results[key].sets, rules);
        if (!check.ok) {
          const sets = results[key].sets.length;
          const maxSets = rules.setsToWin * 2 - 1;
          issues.push(
            sets > maxSets
              ? `${label}: tiene ${sets} sets y ahora se juega ${describeMatchRules(rules)}`
              : `${label}: el marcador no cumple ${describeMatchRules(rules)} (${check.errors.join("; ")})`,
          );
        }
      }
    }
  }
  // Si hay marcadores inválidos, los cambios de duplas en partidos siguientes suelen ser consecuencia de
  // ellos: se muestran primero las causas para no llenar el aviso de ruido.
  return issues.length ? issues : consequences;
}

export interface MatchRulesSummary {
  setsToWin: number;
  setPoints: number;
  decidingSetPoints: number;
}

/** Texto corto del tipo de partido: "1 set a 21" o "Mejor de 3 (21-21-15)". */
export function describeMatchRules(r: MatchRulesSummary): string {
  if (r.setsToWin === 1) return `1 set a ${r.setPoints}`;
  const total = r.setsToWin * 2 - 1;
  const pts = [...Array(total - 1).fill(r.setPoints), r.decidingSetPoints].join("-");
  return `Mejor de ${total} (${pts})`;
}

export type MatchMode = Pick<MatchRules, "setsToWin" | "setPoints" | "decidingSetPoints">;

/**
 * Aplica el tipo de partido elegido al formato: `main` para todas las fases y, si se indica `last`
 * (y hay más de una fase), otro distinto para la última (p. ej. grupos a 1 set y llave al mejor de 3).
 * Reemplaza los tipos de partido que tuvieran las fases; el resto de sus reglas se conserva.
 */
export function applyMatchRules(base: FormatDefinition, main: MatchMode, last: MatchMode | null): FormatDefinition {
  const lastIndex = base.stages.length - 1;
  return {
    ...base,
    rules: { ...base.rules, match: { ...FIVB_RULES.match, ...base.rules.match, ...main } },
    stages: base.stages.map((st, i) => {
      const rest = { ...st.rules };
      delete rest.match;
      const rules = last && i === lastIndex && base.stages.length > 1 ? { ...rest, match: last } : rest;
      return { ...st, rules: Object.keys(rules).length ? rules : undefined };
    }),
  };
}
