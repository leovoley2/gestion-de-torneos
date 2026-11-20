import { describe, expect, it } from "vitest";
import { TEMPLATES, applyMatchRules, validateFormat, describeMatchRules, stageRules, generateFormat, resolveTournament, resultConflicts, type FormatDefinition, type MatchResult } from "./index";

const T = (id: string) => TEMPLATES.find((t) => t.id === id)!;
const teams = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `T${i + 1}`, name: "", seed: i + 1 }));
const setup = (format: FormatDefinition, n = 8) => ({ format, gen: generateFormat(format), teams: teams(n) });
const withSets = (f: FormatDefinition, setsToWin: number): FormatDefinition => ({ ...f, rules: { ...f.rules, match: { ...f.rules.match, setsToWin } } });

describe("cambios con resultados cargados", () => {
  const base = T("single_elimination").build({ teams: 8, thirdPlace: true }); // mejor de 3
  const before = setup(base);
  const first = before.gen.matches[0]; // 1 vs 8
  const bestOf3: Record<string, MatchResult> = { [first.key]: { sets: [{ a: 21, b: 15 }, { a: 18, b: 21 }, { a: 15, b: 10 }] } };
  const twoSets: Record<string, MatchResult> = { [first.key]: { sets: [{ a: 21, b: 15 }, { a: 21, b: 10 }] } };

  it("sin resultados, cualquier cambio es seguro", () => {
    expect(resultConflicts(before, setup(T("double_elimination").build({ teams: 8 })), {})).toEqual([]);
  });

  it("agregar el partido por el 3er puesto conserva los resultados", () => {
    const after = setup(T("single_elimination").build({ teams: 8, thirdPlace: false }));
    expect(resultConflicts(after, before, bestOf3)).toEqual([]);
  });

  it("pasar a 1 set: un partido jugado a 3 sets ya no cumple", () => {
    const issues = resultConflicts(before, setup(withSets(base, 1)), bestOf3);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/^P1 .*tiene 3 sets y ahora se juega 1 set a 21/);
  });

  it("pasar a 1 set: 2-0 tampoco cumple (ya había terminado en el 1er set)", () => {
    expect(resultConflicts(before, setup(withSets(base, 1)), twoSets)).toHaveLength(1);
  });

  it("de 1 set a mejor de 3: un partido a 1 set queda incompleto", () => {
    const oneSet = setup(withSets(base, 1));
    const res = { [first.key]: { sets: [{ a: 21, b: 19 }] } };
    expect(resultConflicts(oneSet, before, res)[0]).toMatch(/no cumple/);
  });

  it("cambiar la estructura (grupos) con resultados avisa los partidos afectados", () => {
    const after = setup(T("groups_knockout").build({ teams: 8, groups: 2, qualifyPerGroup: 2 }));
    expect(resultConflicts(before, after, bestOf3)[0]).toMatch(/no existe|otras duplas/);
  });

  it("reordenar la siembra: bloquea si cambia quién jugó un partido con resultado", () => {
    const swapped = { ...before, teams: before.teams.map((t) => (t.id === "T1" ? { ...t, seed: 2 } : t.id === "T2" ? { ...t, seed: 1 } : t)) };
    expect(resultConflicts(before, swapped, bestOf3)[0]).toMatch(/otras duplas/);
  });

  it("reordenar duplas que todavía no jugaron es seguro", () => {
    // P1 lo juegan los sembrados 1 y 8; intercambiar 3 y 6 no lo toca.
    const swapped = { ...before, teams: before.teams.map((t) => (t.id === "T3" ? { ...t, seed: 6 } : t.id === "T6" ? { ...t, seed: 3 } : t)) };
    const state = resolveTournament(before.format, before.gen, before.teams, bestOf3);
    expect(state.matches[0].status).toBe("finished");
    expect(resultConflicts(before, swapped, bestOf3)).toEqual([]);
  });
});

describe("texto del tipo de partido", () => {
  it("1 set y mejor de 3", () => {
    expect(describeMatchRules({ setsToWin: 1, setPoints: 21, decidingSetPoints: 15 })).toBe("1 set a 21");
    expect(describeMatchRules({ setsToWin: 2, setPoints: 21, decidingSetPoints: 15 })).toBe("Mejor de 3 (21-21-15)");
  });
});

describe("tipo de partido elegido en el formato", () => {
  const twoStages = T("groups_knockout").build({ teams: 8, groups: 2, qualifyPerGroup: 2 });
  const oneSet = { setsToWin: 1, setPoints: 21, decidingSetPoints: 15 };
  const bo3 = { setsToWin: 2, setPoints: 21, decidingSetPoints: 15 };

  it("grupos a 1 set y llave al mejor de 3", () => {
    const f = applyMatchRules(twoStages, oneSet, bo3);
    expect(stageRules(f, f.stages[0]).match.setsToWin).toBe(1);
    expect(stageRules(f, f.stages[1]).match.setsToWin).toBe(2);
    expect(f.rules.match.winBy).toBe(2); // conserva el resto de las reglas
  });

  it("sin tipo distinto para la última fase, todas usan el general y se quitan los anteriores", () => {
    const f = applyMatchRules(applyMatchRules(twoStages, oneSet, bo3), bo3, null);
    expect(f.stages.every((s) => s.rules?.match === undefined)).toBe(true);
    expect(f.stages.map((s) => stageRules(f, s).match.setsToWin)).toEqual([2, 2]);
  });

  it("un partido a 3 sets en la llave se valida contra la regla de la llave", () => {
    const f = applyMatchRules(twoStages, oneSet, bo3);
    const before = setup(f);
    const knockout = before.gen.matches.find((m) => m.stageKey === f.stages[1].key)!;
    const group = before.gen.matches.find((m) => m.stageKey === f.stages[0].key)!;
    // Resultado de grupo a 1 set: válido. Pasar los grupos al mejor de 3 lo invalida.
    const results = { [group.key]: { sets: [{ a: 21, b: 15 }] } };
    expect(resultConflicts(before, before, results)).toEqual([]);
    const issues = resultConflicts(before, setup(applyMatchRules(f, bo3, bo3)), results);
    expect(issues[0]).toMatch(/no cumple Mejor de 3/);
    expect(knockout).toBeDefined();
  });
});

describe("validación del tipo de partido", () => {
  const f = T("single_elimination").build({ teams: 8 });
  const mode = (o: object) => applyMatchRules(f, { setsToWin: 1, setPoints: 21, decidingSetPoints: 15, ...o }, null);

  it("acepta valores normales", () => {
    expect(validateFormat(mode({}), 8)).toEqual([]);
  });

  it("rechaza puntos vacíos o en cero (harían válido un 2-0)", () => {
    expect(validateFormat(mode({ setPoints: 0 }), 8)[0]).toMatch(/puntos del set/);
    expect(validateFormat(mode({ setPoints: null }), 8)[0]).toMatch(/puntos del set/);
    expect(validateFormat(mode({ setsToWin: 0 }), 8)[0]).toMatch(/1 set/);
  });

  it("también revisa las reglas propias de cada fase", () => {
    const g = { ...f, stages: f.stages.map((s) => ({ ...s, rules: { match: { decidingSetPoints: 2 } } })) };
    expect(validateFormat(g, 8)[0]).toMatch(/set decisivo/);
  });
});
