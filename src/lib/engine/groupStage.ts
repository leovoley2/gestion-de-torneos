import { distributeIntoGroups, groupName, seededRandom } from "./seeding";
import type { GroupGen, GroupStageDef, Source, StageOutput } from "./types";

/**
 * Rondas de todos contra todos (método del círculo). Devuelve pares de índices por ronda;
 * con número impar se agrega un "descanso" que no genera partido.
 */
export function roundRobinPairs(n: number): [number, number][][] {
  const ids = Array.from({ length: n % 2 === 0 ? n : n + 1 }, (_, i) => i);
  const rounds: [number, number][][] = [];
  const total = ids.length;
  for (let r = 0; r < total - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < total / 2; i++) {
      const a = ids[i];
      const b = ids[total - 1 - i];
      if (a < n && b < n) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    ids.splice(1, 0, ids.pop()!); // rota todos menos el primero
  }
  return rounds;
}

export function generateGroupStage(stage: GroupStageDef): StageOutput {
  const random = seededRandom(stage.drawSeed ?? 1);
  const buckets = distributeIntoGroups(stage.entrants, stage.groupCount, stage.seeding, {
    manualGroups: stage.manualGroups,
    random,
  });

  const groups: GroupGen[] = [];
  const matches: StageOutput["matches"] = [];
  const placements: Record<string, Source[]> = {};

  buckets.forEach((slots, gi) => {
    const name = groupName(gi);
    const groupKey = `${stage.key}-${name}`;
    groups.push({ key: groupKey, stageKey: stage.key, name, slots });

    const add = (round: number, idx: number, label: string, a: Source, b: Source) => {
      const key = `${groupKey}-${idx}`;
      matches.push({ key, stageKey: stage.key, groupKey, round, bracket: "group", label, a, b });
      return key;
    };

    if (stage.type === "pool_fivb" && slots.length === 4) {
      // Pool FIVB: 1v4 y 2v3; luego ganadores y perdedores. Los puestos salen de esos dos partidos.
      const m1 = add(1, 1, `Grupo ${name} · 1 vs 4`, slots[0], slots[3]);
      const m2 = add(1, 2, `Grupo ${name} · 2 vs 3`, slots[1], slots[2]);
      const w = add(2, 3, `Grupo ${name} · Ganadores`, { type: "match_winner", matchKey: m1 }, { type: "match_winner", matchKey: m2 });
      const l = add(2, 4, `Grupo ${name} · Perdedores`, { type: "match_loser", matchKey: m1 }, { type: "match_loser", matchKey: m2 });
      placements[groupKey] = [
        { type: "match_winner", matchKey: w },
        { type: "match_loser", matchKey: w },
        { type: "match_winner", matchKey: l },
        { type: "match_loser", matchKey: l },
      ];
      return;
    }

    const legs = stage.doubleRound ? 2 : 1;
    const rounds = roundRobinPairs(slots.length);
    let idx = 1;
    for (let leg = 0; leg < legs; leg++) {
      rounds.forEach((pairs, r) => {
        const round = leg * rounds.length + r + 1;
        for (const [i, j] of pairs) {
          const [a, b] = leg === 0 ? [slots[i], slots[j]] : [slots[j], slots[i]];
          add(round, idx++, `Grupo ${name} · Ronda ${round}`, a, b);
        }
      });
    }
  });

  return { groups, matches, placements };
}
