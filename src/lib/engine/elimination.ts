import { bracketSeedOrder, nextPowerOfTwo } from "./seeding";
import type {
  Bracket,
  DoubleEliminationDef,
  SingleEliminationDef,
  Source,
  StageOutput,
} from "./types";

type Slot = Source | null; // null = bye (no hay equipo)

/**
 * Crea partidos de una fase. Si un lado es bye, no se crea partido: el otro lado pasa directo.
 * Así una llave de 6, 12 o 20 equipos funciona igual que una de 8, 16 o 32.
 */
function matchBuilder(stageKey: string) {
  const matches: StageOutput["matches"] = [];
  let idx = 0;
  const play = (
    a: Slot,
    b: Slot,
    meta: { round: number; bracket: Bracket; label: string; conditional?: boolean },
  ): { winner: Slot; loser: Slot } => {
    if (!a || !b) return { winner: a ?? b, loser: null };
    const key = `${stageKey}-${++idx}`;
    matches.push({ key, stageKey, a, b, ...meta });
    return { winner: { type: "match_winner", matchKey: key }, loser: { type: "match_loser", matchKey: key } };
  };
  return { matches, play };
}

const roundName = (matchesInRound: number) => {
  switch (matchesInRound) {
    case 1:
      return "Final";
    case 2:
      return "Semifinal";
    case 4:
      return "Cuartos de final";
    case 8:
      return "Octavos de final";
    default:
      return `Ronda de ${matchesInRound * 2}`;
  }
};

/** Coloca las fuentes en la llave según el orden estándar de siembra (los que faltan son bye). */
function seedSlots(entrants: Source[]): Slot[] {
  const size = nextPowerOfTwo(Math.max(entrants.length, 2));
  return bracketSeedOrder(size).map((seed) => entrants[seed - 1] ?? null);
}

function pairUp(slots: Slot[]): [Slot, Slot][] {
  const pairs: [Slot, Slot][] = [];
  for (let i = 0; i < slots.length; i += 2) pairs.push([slots[i], slots[i + 1] ?? null]);
  return pairs;
}

export function generateSingleElimination(stage: SingleEliminationDef): StageOutput {
  const { matches, play } = matchBuilder(stage.key);
  let current = seedSlots(stage.entrants);
  let semiLosers: Slot[] = [];
  let finalResult: { winner: Slot; loser: Slot } = { winner: current[0], loser: null };
  let round = 1;

  while (current.length > 1) {
    const pairs = pairUp(current);
    const name = roundName(pairs.length);
    const results = pairs.map(([a, b], i) =>
      play(a, b, { round, bracket: "main", label: pairs.length > 1 ? `${name} ${i + 1}` : name }),
    );
    if (pairs.length === 2) semiLosers = results.map((r) => r.loser);
    if (pairs.length === 1) finalResult = results[0];
    current = results.map((r) => r.winner);
    round++;
  }

  const placements: Slot[] = [finalResult.winner, finalResult.loser];
  if (stage.thirdPlace && semiLosers.length === 2) {
    const third = play(semiLosers[0], semiLosers[1], { round: round - 1, bracket: "placement", label: "Tercer puesto" });
    placements.push(third.winner, third.loser);
  }

  return {
    groups: [],
    matches,
    placements: { [stage.key]: placements.filter((s): s is Source => s !== null) },
  };
}

export function generateDoubleElimination(stage: DoubleEliminationDef): StageOutput {
  const { matches, play } = matchBuilder(stage.key);

  // ── Llave de ganadores ──
  let current = seedSlots(stage.entrants);
  const winnersLosers: Slot[][] = []; // perdedores de cada ronda de ganadores
  let round = 1;
  while (current.length > 1) {
    const pairs = pairUp(current);
    const label = pairs.length === 1 ? "Final de ganadores" : `Ganadores R${round}`;
    const results = pairs.map(([a, b], i) =>
      play(a, b, { round, bracket: "winners", label: pairs.length > 1 ? `${label} · ${i + 1}` : label }),
    );
    winnersLosers.push(results.map((r) => r.loser));
    current = results.map((r) => r.winner);
    round++;
  }
  const winnersChampion = current[0];

  // ── Llave de perdedores ──
  // R1: se cruzan los perdedores de la 1ª ronda. Luego se alternan:
  //   "entrada": ganadores de perdedores vs perdedores que bajan de ganadores (en orden invertido
  //   para evitar revanchas inmediatas) y "consolidación": ganadores de perdedores entre sí.
  let lr = 1;
  const lMatch = (pairs: [Slot, Slot][], isLast: boolean) => {
    const label = isLast ? "Final de perdedores" : `Perdedores R${lr}`;
    const results = pairs.map(([a, b], i) =>
      play(a, b, { round: lr, bracket: "losers", label: pairs.length > 1 ? `${label} · ${i + 1}` : label }),
    );
    lr++;
    return results;
  };

  const k = winnersLosers.length;
  let losers: Slot[] = winnersLosers[0] ?? [];
  let lastLosersResult: { winner: Slot; loser: Slot } | null = null;
  let losersThird: Slot = null; // perdedor de la final de perdedores = 3er puesto

  if (k >= 2) {
    losers = lMatch(pairUp(losers), false).map((r) => r.winner);
    for (let r = 1; r < k; r++) {
      const dropping = [...winnersLosers[r]];
      if (r % 2 === 1) dropping.reverse();
      const isLosersFinal = r === k - 1;
      const entry = lMatch(
        losers.map((s, i) => [s, dropping[i] ?? null] as [Slot, Slot]),
        isLosersFinal,
      );
      if (isLosersFinal) {
        lastLosersResult = entry[0];
        losersThird = entry[0].loser;
      }
      losers = entry.map((e) => e.winner);
      if (!isLosersFinal && losers.length > 1) {
        losers = lMatch(pairUp(losers), false).map((e) => e.winner);
      }
    }
  }
  const losersChampion = lastLosersResult?.winner ?? losers[0] ?? null;

  // ── Gran final ──
  const gf = play(winnersChampion, losersChampion, { round: 1, bracket: "final", label: "Gran final" });
  let champion = gf.winner;
  let runnerUp = gf.loser;
  if (stage.grandFinalReset && gf.loser) {
    const reset = play(gf.winner, gf.loser, {
      round: 2,
      bracket: "final",
      label: "Gran final (desempate)",
      conditional: true,
    });
    champion = reset.winner;
    runnerUp = reset.loser;
  }

  return {
    groups: [],
    matches,
    placements: {
      [stage.key]: [champion, runnerUp, losersThird].filter((s): s is Source => s !== null),
    },
  };
}
