import { describe, expect, it } from "vitest";
import {
  FIVB_RULES,
  TEMPLATES,
  bracketSeedOrder,
  checkMatch,
  distributeIntoGroups,
  generateFormat,
  resolveTournament,
  type FormatDefinition,
  type TeamRef,
} from "./index";
import { roundRobinPairs } from "./groupStage";
import { simulateTournament } from "./simulate";

const makeTeams = (n: number): TeamRef[] =>
  Array.from({ length: n }, (_, i) => ({ id: `T${i + 1}`, name: `Dupla ${i + 1}`, seed: i + 1 }));

const template = (id: string) => TEMPLATES.find((t) => t.id === id)!;

describe("siembra", () => {
  it("serpentina reparte 1-8-9-16 en el mismo grupo con 4 grupos", () => {
    const groups = distributeIntoGroups([...Array(16)].map((_, i) => i + 1), 4, "serpentine");
    expect(groups[0]).toEqual([1, 8, 9, 16]);
    expect(groups[3]).toEqual([4, 5, 12, 13]);
  });

  it("orden estándar de llave separa a 1 y 2", () => {
    expect(bracketSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("todos contra todos: cada par se juega una vez, también con impares", () => {
    for (const n of [3, 4, 5, 6]) {
      const pairs = roundRobinPairs(n).flat().map(([a, b]) => [Math.min(a, b), Math.max(a, b)].join("-"));
      expect(pairs.length).toBe((n * (n - 1)) / 2);
      expect(new Set(pairs).size).toBe(pairs.length);
    }
  });
});

describe("marcador FIVB", () => {
  const r = FIVB_RULES.match;
  it("acepta 21-19, 19-21, 15-13", () => {
    expect(checkMatch([{ a: 21, b: 19 }, { a: 19, b: 21 }, { a: 15, b: 13 }], r)).toMatchObject({ ok: true, winner: "a" });
  });
  it("acepta sets largos 28-26", () => {
    expect(checkMatch([{ a: 28, b: 26 }, { a: 21, b: 10 }], r).ok).toBe(true);
  });
  it("rechaza 21-20, 23-19 y sets de más", () => {
    expect(checkMatch([{ a: 21, b: 20 }, { a: 21, b: 10 }], r).ok).toBe(false);
    expect(checkMatch([{ a: 23, b: 19 }, { a: 21, b: 10 }], r).ok).toBe(false);
    expect(checkMatch([{ a: 21, b: 10 }, { a: 21, b: 10 }, { a: 15, b: 3 }], r).ok).toBe(false);
  });
});

describe("generación de llaves", () => {
  it("eliminación directa: n-1 partidos (+1 por 3er puesto), con byes", () => {
    for (const n of [4, 6, 8, 12, 16]) {
      const gen = generateFormat(template("single_elimination").build({ teams: n, thirdPlace: true }));
      expect(gen.matches.length).toBe(n - 1 + 1);
    }
  });

  it("doble eliminación: 2n-2 partidos (+1 con final de desempate)", () => {
    for (const n of [4, 6, 8, 12, 16, 32]) {
      expect(generateFormat(template("double_elimination").build({ teams: n })).matches.length).toBe(2 * n - 2);
      expect(
        generateFormat(template("double_elimination").build({ teams: n, grandFinalReset: true })).matches.length,
      ).toBe(2 * n - 1);
    }
  });

  it("pool FIVB: 4 partidos por pool", () => {
    const gen = generateFormat(template("pool_fivb_knockout").build({ teams: 16, groups: 4, qualifyPerGroup: 2 }));
    expect(gen.matches.filter((m) => m.stageKey === "S1").length).toBe(16);
  });
});

describe("simulación completa: todas las plantillas llegan a un campeón", () => {
  const cases: [string, Parameters<(typeof TEMPLATES)[number]["build"]>[0]][] = [
    ["groups_knockout", { teams: 16, groups: 4, qualifyPerGroup: 2 }],
    ["groups_knockout", { teams: 12, groups: 3, qualifyPerGroup: 2, bestNext: 2 }],
    ["pool_fivb_knockout", { teams: 16, groups: 4, qualifyPerGroup: 3 }],
    ["groups_double", { teams: 16, groups: 4, qualifyPerGroup: 2, grandFinalReset: true }],
    ["double_elimination", { teams: 12, grandFinalReset: true }],
    ["single_elimination", { teams: 10 }],
    ["round_robin", { teams: 5 }],
    ["groups_crossover_knockout", { teams: 16, groups: 4 }],
  ];
  for (const [id, opts] of cases) {
    it(`${id} ${JSON.stringify(opts)}`, () => {
      const format = template(id).build(opts);
      const gen = generateFormat(format);
      const teams = makeTeams(opts.teams);
      const { state } = simulateTournament(format, gen, teams);
      const pending = state.matches.filter((m) => m.status !== "finished" && m.status !== "cancelled");
      expect(pending).toEqual([]);
      const lastStage = format.stages[format.stages.length - 1].key;
      const podium = state.placements[lastStage] ?? state.placements[`${lastStage}-A`];
      expect(podium?.[0]).toMatch(/^T\d+$/);
      // Nadie juega contra sí mismo
      expect(state.matches.every((m) => m.teamA !== m.teamB)).toBe(true);
    });
  }
});

describe("doble eliminación", () => {
  it("nadie queda eliminado con una sola derrota y el campeón pierde a lo más una vez", () => {
    const format = template("double_elimination").build({ teams: 8, grandFinalReset: true });
    const gen = generateFormat(format);
    const { state } = simulateTournament(format, gen, makeTeams(8), 3);
    const played = state.matches.filter((m) => m.status === "finished");
    const losses = new Map<string, number>();
    for (const m of played) losses.set(m.loser!, (losses.get(m.loser!) ?? 0) + 1);
    const champion = state.placements.S1[0]!;
    expect(losses.get(champion) ?? 0).toBeLessThanOrEqual(1);
    for (const t of makeTeams(8)) {
      if (t.id !== champion) expect(losses.get(t.id)).toBe(2);
    }
  });
});

describe("posiciones", () => {
  it("cuenta 2-0 / 2-1 y ordena por puntos y enfrentamiento directo", () => {
    const format: FormatDefinition = template("round_robin").build({ teams: 3 });
    const gen = generateFormat(format);
    const teams = makeTeams(3);
    const find = (x: string, y: string) =>
      gen.matches.find((m) => {
        const ids = [m.a, m.b].map((s) => (s?.type === "seed" ? `T${s.seed}` : ""));
        return ids.includes(x) && ids.includes(y);
      })!;
    const res = (m: ReturnType<typeof find>, winner: string, loserSets: 0 | 1) => {
      const aIsWinner = m.a?.type === "seed" && `T${m.a.seed}` === winner;
      const w = { a: 21, b: 15 };
      const l = { a: 15, b: 21 };
      const sets = loserSets === 0 ? [w, w] : [w, l, { a: 15, b: 10 }];
      return { sets: aIsWinner ? sets : sets.map((s) => ({ a: s.b, b: s.a })) };
    };
    // T3 le gana a T1, T1 le gana a T2, T2 le gana a T3 → triple empate en puntos
    const results = {
      [find("T1", "T3").key]: res(find("T1", "T3"), "T3", 1),
      [find("T1", "T2").key]: res(find("T1", "T2"), "T1", 0),
      [find("T2", "T3").key]: res(find("T2", "T3"), "T2", 0),
    };
    const state = resolveTournament(format, gen, teams, results);
    const table = state.standings["S1-A"];
    expect(table.map((r) => r.points)).toEqual([3, 3, 3]);
    const t3 = table.find((r) => r.teamId === "T3")!;
    expect(t3.win21).toBe(1);
    expect(t3.loss02).toBe(1);
    // Empate total en puntos y en directo (1 victoria cada uno) → decide el ratio de puntos.
    const ratios = table.map((r) => r.pointRatio);
    expect([...ratios].sort((a, b) => b - a)).toEqual(ratios);
  });
});
