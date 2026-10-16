import { generateDoubleElimination, generateSingleElimination } from "./elimination";
import { generateGroupStage } from "./groupStage";
import type { FormatDefinition, GeneratedFormat, StageDef, StageOutput } from "./types";

function generateStage(stage: StageDef): StageOutput {
  switch (stage.type) {
    case "round_robin":
    case "pool_fivb":
      return generateGroupStage(stage);
    case "single_elimination":
      return generateSingleElimination(stage);
    case "double_elimination":
      return generateDoubleElimination(stage);
    case "crossover":
    case "custom":
      return {
        groups: [],
        placements: {},
        matches: stage.matches.map((m, i) => ({
          key: `${stage.key}-${m.key}`,
          stageKey: stage.key,
          round: 1,
          bracket: "crossover",
          label: m.label || `Cruce ${i + 1}`,
          a: m.a,
          b: m.b,
        })),
      };
  }
}

/** Genera todos los grupos y partidos de un formato, numerando los partidos P1, P2… */
export function generateFormat(format: FormatDefinition): GeneratedFormat {
  const out: GeneratedFormat = { groups: [], matches: [], placements: {} };
  let number = 1;
  for (const stage of format.stages) {
    const part = generateStage(stage);
    out.groups.push(...part.groups);
    Object.assign(out.placements, part.placements);
    // Orden de juego dentro de la fase: por ronda y, en doble eliminación, ganadores antes que perdedores.
    const bracketOrder = ["group", "crossover", "placement", "main", "winners", "losers", "final"];
    const sorted = [...part.matches].sort(
      (x, y) =>
        (x.bracket === "final" ? 1 : 0) - (y.bracket === "final" ? 1 : 0) ||
        x.round - y.round ||
        bracketOrder.indexOf(x.bracket) - bracketOrder.indexOf(y.bracket),
    );
    for (const m of sorted) out.matches.push({ ...m, number: number++ });
  }
  return out;
}
