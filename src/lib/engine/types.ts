// Tipos del motor de formatos. Un torneo es un grafo de partidos:
// cada lado de un partido declara de dónde sale su equipo (Source).

export type Source =
  | { type: "team"; teamId: string }
  | { type: "seed"; seed: number }
  | { type: "group_position"; groupKey: string; position: number }
  | { type: "match_winner"; matchKey: string }
  | { type: "match_loser"; matchKey: string }
  // Ej. "2º mejor tercero de la fase de grupos": se toma el `position` de cada grupo y se ordenan.
  | { type: "ranking_position"; stageKey: string; position: number; rank: number };

export type Bracket = "group" | "main" | "winners" | "losers" | "final" | "placement" | "crossover";

export interface MatchRules {
  setsToWin: number; // 2 = al mejor de 3
  setPoints: number; // 21
  decidingSetPoints: number; // 15
  winBy: number; // 2
  cap: number | null; // tope de puntos (null = sin tope)
}

export interface ScoringRules {
  win20: number;
  win21: number;
  loss12: number;
  loss02: number;
  woWin: number;
  woLoss: number;
}

export type TiebreakCriterion =
  | "points"
  | "wins"
  | "set_ratio"
  | "point_ratio"
  | "head_to_head"
  | "seed";

export interface Rules {
  match: MatchRules;
  scoring: ScoringRules;
  tiebreak: TiebreakCriterion[];
}

export type SeedingMethod = "serpentine" | "sequential" | "random" | "manual";

interface StageBase {
  key: string;
  name: string;
  rules?: { match?: Partial<MatchRules>; scoring?: Partial<ScoringRules>; tiebreak?: TiebreakCriterion[] };
}

export interface GroupStageDef extends StageBase {
  type: "round_robin" | "pool_fivb";
  groupCount: number;
  /** Fuentes ordenadas por siembra (1º = mejor sembrado). */
  entrants: Source[];
  seeding: SeedingMethod;
  /** Solo para seeding "manual": entrants[i] va al grupo manualGroups[i] (0 = A). */
  manualGroups?: number[];
  /** Semilla del sorteo (seeding "random"), para que se pueda reproducir. */
  drawSeed?: number;
  doubleRound?: boolean;
}

export interface SingleEliminationDef extends StageBase {
  type: "single_elimination";
  entrants: Source[];
  thirdPlace: boolean;
}

export interface DoubleEliminationDef extends StageBase {
  type: "double_elimination";
  entrants: Source[];
  /** Si el que viene de perdedores gana la final, se juega una segunda final. */
  grandFinalReset: boolean;
}

export interface CustomStageDef extends StageBase {
  type: "crossover" | "custom";
  matches: { key: string; label: string; a: Source; b: Source }[];
}

export type StageDef = GroupStageDef | SingleEliminationDef | DoubleEliminationDef | CustomStageDef;

export interface FormatDefinition {
  name: string;
  rules: Rules;
  stages: StageDef[];
}

// ───── Estructura generada ─────

export interface GroupGen {
  key: string; // "S1-A"
  stageKey: string;
  name: string; // "A"
  slots: Source[];
}

export interface MatchGen {
  key: string;
  number: number;
  stageKey: string;
  groupKey?: string;
  round: number;
  bracket: Bracket;
  label: string;
  a: Source | null;
  b: Source | null;
  /** Final de reinicio: solo se juega si gana el equipo que viene de perdedores. */
  conditional?: boolean;
}

export interface GeneratedFormat {
  groups: GroupGen[];
  matches: MatchGen[];
  /**
   * Puestos que salen de partidos (no de una tabla): clave = groupKey (pool FIVB) o stageKey
   * (eliminación). placements[k][0] = 1º puesto. Los grupos sin entrada usan la tabla de posiciones.
   */
  placements: Record<string, Source[]>;
}

// ───── Estado en juego ─────

export interface TeamRef {
  id: string;
  name: string;
  seed: number;
}

export interface SetScore {
  a: number;
  b: number;
}

export interface MatchResult {
  sets: SetScore[];
  /** W.O.: id del equipo que gana por no presentación del rival. */
  walkoverWinner?: string;
}

export interface ResolvedMatch extends MatchGen {
  teamA: string | null;
  teamB: string | null;
  status: "undefined" | "ready" | "finished" | "cancelled";
  winner: string | null;
  loser: string | null;
  result?: MatchResult;
  /** Errores del marcador cargado (no cumple las reglas). */
  errors?: string[];
}

export interface StandingRow {
  teamId: string;
  played: number;
  wins: number;
  losses: number;
  win20: number;
  win21: number;
  loss12: number;
  loss02: number;
  points: number;
  setsWon: number;
  setsLost: number;
  pointsFor: number;
  pointsAgainst: number;
  setRatio: number;
  pointRatio: number;
  position: number;
}

/** Lo que produce el generador de una fase (los números de partido se asignan al final). */
export type StageOutput = Omit<GeneratedFormat, "matches"> & { matches: Omit<MatchGen, "number">[] };
