import type { FormatDefinition, Rules, StageDef } from "./types";

/** Reglas FIVB por defecto para vóley playa. */
export const FIVB_RULES: Rules = {
  match: { setsToWin: 2, setPoints: 21, decidingSetPoints: 15, winBy: 2, cap: null },
  scoring: { win20: 2, win21: 2, loss12: 1, loss02: 1, woWin: 2, woLoss: 0 },
  tiebreak: ["points", "head_to_head", "point_ratio", "set_ratio", "seed"],
};

/** Reglas efectivas de una fase: las de la categoría con lo que la fase sobrescriba. */
export function stageRules(format: FormatDefinition, stage: StageDef): Rules {
  const base = format.rules;
  return {
    match: { ...base.match, ...stage.rules?.match },
    scoring: { ...base.scoring, ...stage.rules?.scoring },
    tiebreak: stage.rules?.tiebreak ?? base.tiebreak,
  };
}
