import type { MatchRules, SetScore } from "./types";

/** Valida un set terminado. Devuelve un mensaje de error o null si es válido. */
export function validateSet(set: SetScore, deciding: boolean, rules: MatchRules): string | null {
  const target = deciding ? rules.decidingSetPoints : rules.setPoints;
  const hi = Math.max(set.a, set.b);
  const lo = Math.min(set.a, set.b);
  if (set.a < 0 || set.b < 0 || !Number.isInteger(set.a) || !Number.isInteger(set.b)) {
    return "Los puntos deben ser enteros positivos";
  }
  if (rules.cap !== null && hi === rules.cap && hi - lo >= 1) return null;
  if (hi < target) return `El set debe llegar al menos a ${target}`;
  if (hi - lo < rules.winBy) return `Se necesita una diferencia de ${rules.winBy} puntos`;
  if (hi > target && hi - lo !== rules.winBy) {
    return `Pasado ${target}, el set termina con ${rules.winBy} de diferencia`;
  }
  return null;
}

export interface ScoreCheck {
  ok: boolean;
  errors: string[];
  setsA: number;
  setsB: number;
  winner: "a" | "b" | null;
}

/** Valida un partido completo según las reglas (sets, set decisivo, sets de más). */
export function checkMatch(sets: SetScore[], rules: MatchRules): ScoreCheck {
  const errors: string[] = [];
  let setsA = 0;
  let setsB = 0;
  const maxSets = rules.setsToWin * 2 - 1;
  sets.forEach((set, i) => {
    if (setsA === rules.setsToWin || setsB === rules.setsToWin) {
      errors.push(`Set ${i + 1}: el partido ya había terminado`);
      return;
    }
    const deciding = i === maxSets - 1 && maxSets > 1;
    const err = validateSet(set, deciding, rules);
    if (err) errors.push(`Set ${i + 1}: ${err}`);
    if (set.a > set.b) setsA++;
    else if (set.b > set.a) setsB++;
  });
  const winner = setsA === rules.setsToWin ? "a" : setsB === rules.setsToWin ? "b" : null;
  if (!winner && errors.length === 0) errors.push("El partido no está completo");
  return { ok: errors.length === 0, errors, setsA, setsB, winner };
}
