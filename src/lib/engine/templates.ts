import { FIVB_RULES } from "./rules";
import { groupName } from "./seeding";
import type { FormatDefinition, Rules, SeedingMethod, Source, StageDef } from "./types";

// Las plantillas solo producen una FormatDefinition: un punto de partida que el organizador
// puede editar (fases, cruces, reglas, partidos) antes y después de generar.

const seeds = (n: number): Source[] => Array.from({ length: n }, (_, i) => ({ type: "seed", seed: i + 1 }));

/**
 * Clasificados de una fase de grupos, ordenados para la llave: primero todos los 1º, luego los 2º…
 * Con el orden estándar de siembra, el 1º de un grupo no cruza al 2º de su mismo grupo en la 1ª ronda.
 */
export function qualifiers(stageKey: string, groupCount: number, perGroup: number, bestNext = 0): Source[] {
  const out: Source[] = [];
  for (let p = 1; p <= perGroup; p++) {
    for (let g = 0; g < groupCount; g++) {
      out.push({ type: "group_position", groupKey: `${stageKey}-${groupName(g)}`, position: p });
    }
  }
  for (let r = 1; r <= bestNext; r++) {
    out.push({ type: "ranking_position", stageKey, position: perGroup + 1, rank: r });
  }
  return out;
}

export interface TemplateOptions {
  teams: number;
  groups?: number;
  qualifyPerGroup?: number;
  bestNext?: number; // mejores N del siguiente puesto (ej. mejores terceros)
  thirdPlace?: boolean;
  grandFinalReset?: boolean;
  doubleRound?: boolean;
  seeding?: SeedingMethod;
  rules?: Rules;
}

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  uses: (keyof TemplateOptions)[];
  build: (o: TemplateOptions) => FormatDefinition;
}

function groupStage(o: TemplateOptions, type: "round_robin" | "pool_fivb"): StageDef {
  return {
    key: "S1",
    name: type === "pool_fivb" ? "Pools (FIVB)" : "Fase de grupos",
    type,
    groupCount: o.groups ?? 4,
    entrants: seeds(o.teams),
    seeding: o.seeding ?? "serpentine",
    doubleRound: o.doubleRound,
  };
}

const groupsThen =
  (type: "round_robin" | "pool_fivb", knockout: "single" | "double") =>
  (o: TemplateOptions): FormatDefinition => {
    const g = o.groups ?? 4;
    const entrants = qualifiers("S1", g, o.qualifyPerGroup ?? 2, o.bestNext ?? 0);
    const second: StageDef =
      knockout === "single"
        ? { key: "S2", name: "Llave final", type: "single_elimination", entrants, thirdPlace: o.thirdPlace ?? true }
        : { key: "S2", name: "Doble eliminación", type: "double_elimination", entrants, grandFinalReset: o.grandFinalReset ?? false };
    return {
      name: `${type === "pool_fivb" ? "Pools FIVB" : "Grupos"} + ${knockout === "single" ? "llave" : "doble eliminación"}`,
      rules: o.rules ?? FIVB_RULES,
      stages: [groupStage(o, type), second],
    };
  };

export const TEMPLATES: TemplateInfo[] = [
  {
    id: "groups_knockout",
    name: "Grupos + llave",
    description: "Todos contra todos en grupos; los mejores pasan a eliminación directa.",
    uses: ["teams", "groups", "qualifyPerGroup", "bestNext", "thirdPlace", "seeding", "doubleRound"],
    build: groupsThen("round_robin", "single"),
  },
  {
    id: "pool_fivb_knockout",
    name: "Pools FIVB + llave",
    description: "Pools de 4: 1v4, 2v3, partido de ganadores y de perdedores. Luego eliminación directa.",
    uses: ["teams", "groups", "qualifyPerGroup", "thirdPlace", "seeding"],
    build: groupsThen("pool_fivb", "single"),
  },
  {
    id: "groups_double",
    name: "Grupos + doble eliminación",
    description: "Fase de grupos y los clasificados juegan doble eliminación.",
    uses: ["teams", "groups", "qualifyPerGroup", "bestNext", "grandFinalReset", "seeding"],
    build: groupsThen("round_robin", "double"),
  },
  {
    id: "double_elimination",
    name: "Doble eliminación",
    description: "Llave de ganadores y de perdedores: se queda fuera quien pierde dos veces.",
    uses: ["teams", "grandFinalReset"],
    build: (o) => ({
      name: "Doble eliminación",
      rules: o.rules ?? FIVB_RULES,
      stages: [
        { key: "S1", name: "Doble eliminación", type: "double_elimination", entrants: seeds(o.teams), grandFinalReset: o.grandFinalReset ?? false },
      ],
    }),
  },
  {
    id: "single_elimination",
    name: "Eliminación directa",
    description: "Llave simple sembrada por ranking, con byes si no es potencia de 2.",
    uses: ["teams", "thirdPlace"],
    build: (o) => ({
      name: "Eliminación directa",
      rules: o.rules ?? FIVB_RULES,
      stages: [
        { key: "S1", name: "Llave", type: "single_elimination", entrants: seeds(o.teams), thirdPlace: o.thirdPlace ?? true },
      ],
    }),
  },
  {
    id: "round_robin",
    name: "Todos contra todos",
    description: "Liga corta: un solo grupo, todos se enfrentan.",
    uses: ["teams", "doubleRound"],
    build: (o) => ({
      name: "Todos contra todos",
      rules: o.rules ?? FIVB_RULES,
      stages: [{ ...groupStage({ ...o, groups: 1 }, "round_robin"), name: "Liga" }],
    }),
  },
  {
    id: "groups_crossover_knockout",
    name: "Grupos + cruces + llave",
    description: "Los 1º pasan directo; 2º y 3º juegan un cruce para entrar a la llave.",
    uses: ["teams", "groups", "thirdPlace", "seeding"],
    build: (o) => {
      const g = o.groups ?? 4;
      const pos = (gi: number, p: number): Source => ({ type: "group_position", groupKey: `S1-${groupName(gi)}`, position: p });
      // 2º de un grupo contra 3º del grupo "vecino" (A↔B, C↔D…).
      const partner = (i: number) => ((i ^ 1) < g ? i ^ 1 : i);
      const cross = Array.from({ length: g }, (_, i) => ({
        key: `X${i + 1}`,
        label: `Cruce ${i + 1}: 2º ${groupName(i)} vs 3º ${groupName(partner(i))}`,
        a: pos(i, 2),
        b: pos(partner(i), 3),
      }));
      const firsts = Array.from({ length: g }, (_, i) => pos(i, 1));
      const crossWinners: Source[] = cross.map((c) => ({ type: "match_winner", matchKey: `S2-${c.key}` }));
      return {
        name: "Grupos + cruces + llave",
        rules: o.rules ?? FIVB_RULES,
        stages: [
          groupStage(o, "round_robin"),
          { key: "S2", name: "Cruces", type: "crossover", matches: cross },
          { key: "S3", name: "Llave final", type: "single_elimination", entrants: [...firsts, ...crossWinners], thirdPlace: o.thirdPlace ?? true },
        ],
      };
    },
  },
];
