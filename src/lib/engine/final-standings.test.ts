import { describe, expect, it } from "vitest";
import { TEMPLATES, finalStandings, generateFormat, tieSizes } from "./index";
import { simulateTournament } from "./simulate";

const T = (id: string) => TEMPLATES.find((t) => t.id === id)!;
const teams = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `T${i + 1}`, name: "", seed: i + 1 }));

function standings(id: string, opts: Parameters<(typeof TEMPLATES)[number]["build"]>[0], seed = 3) {
  const f = T(id).build(opts);
  const g = generateFormat(f);
  const ts = teams(opts.teams);
  const { state } = simulateTournament(f, g, ts, seed);
  return { f, state, fs: finalStandings(f, g, state, ts.map((t) => t.id)) };
}

const positions = (fs: { position: number }[]) => fs.map((p) => p.position);

describe("posiciones finales", () => {
  it("eliminación directa de 8 con 3er puesto: 1, 2, 3, 4 y cuatro 5º", () => {
    const { fs, state } = standings("single_elimination", { teams: 8, thirdPlace: true });
    expect(positions(fs)).toEqual([1, 2, 3, 4, 5, 5, 5, 5]);
    expect(fs[0].teamId).toBe(state.placements.S1[0]);
  });

  it("sin partido por el 3er puesto, los perdedores de semis empatan en 3º", () => {
    const { fs } = standings("single_elimination", { teams: 8, thirdPlace: false });
    expect(positions(fs)).toEqual([1, 2, 3, 3, 5, 5, 5, 5]);
  });

  it("16 duplas en grupos + llave de 8: eliminados en grupos se ordenan por su puesto", () => {
    const { fs } = standings("groups_knockout", { teams: 16, groups: 4, qualifyPerGroup: 2, thirdPlace: true });
    expect(positions(fs)).toEqual([1, 2, 3, 4, 5, 5, 5, 5, 9, 9, 9, 9, 13, 13, 13, 13]);
  });

  it("doble eliminación de 8: 1, 2, 3 y luego por ronda de perdedores", () => {
    const { fs } = standings("double_elimination", { teams: 8, grandFinalReset: true });
    expect(positions(fs)).toEqual([1, 2, 3, 4, 5, 5, 7, 7]);
  });

  it("todas las duplas reciben posición y los empates se cuentan bien", () => {
    const { fs } = standings("pool_fivb_knockout", { teams: 16, groups: 4, qualifyPerGroup: 2 });
    expect(fs).toHaveLength(16);
    const sizes = tieSizes(fs);
    expect([...sizes.values()].reduce((a, b) => a + b, 0)).toBe(16);
  });

  it("liga (todos contra todos): orden de la tabla", () => {
    const { fs } = standings("round_robin", { teams: 5 });
    expect(positions(fs)).toEqual([1, 2, 3, 4, 5]);
  });
});
