import { describe, expect, it } from "vitest";
import { buildRanking, pairPointsFor, pointsAt, tableIssues, teamPoints, type CategoryResult, type PointRow } from "./ranking-calc";

const NACIONAL: PointRow[] = [
  { from: 1, to: 1, points: 200 },
  { from: 2, to: 2, points: 180 },
  { from: 3, to: 3, points: 160 },
  { from: 4, to: 4, points: 140 },
  { from: 5, to: 8, points: 120 },
  { from: 9, to: 16, points: 100 },
];

describe("puntos por puesto", () => {
  it("lee la tabla por rangos", () => {
    expect(pointsAt(NACIONAL, 1)).toBe(200);
    expect(pointsAt(NACIONAL, 7)).toBe(120);
    expect(pointsAt(NACIONAL, 40)).toBe(0);
  });
  it("empate: promedio de los puestos que ocupan", () => {
    expect(pairPointsFor(NACIONAL, 5, 4)).toBe(120); // 5º–8º valen igual
    expect(pairPointsFor(NACIONAL, 3, 2)).toBe(150); // 3º y 4º empatados: (160 + 140) / 2
    expect(pairPointsFor(NACIONAL, 1, 1)).toBe(200);
  });
});

describe("ranking individual", () => {
  // Etapa 1: Ana/Bea ganan, Cata/Dani 2º. Etapa 2: se separan → Ana/Cata ganan, Bea/Dani 2º.
  const etapa1: CategoryResult = {
    categoryId: "e1",
    label: "Etapa 1",
    date: "2026-03-01",
    table: NACIONAL,
    teams: [
      { athleteIds: ["ana", "bea"], position: 1, tieSize: 1 },
      { athleteIds: ["cata", "dani"], position: 2, tieSize: 1 },
    ],
  };
  const etapa2: CategoryResult = {
    categoryId: "e2",
    label: "Etapa 2",
    date: "2026-05-01",
    table: NACIONAL,
    teams: [
      { athleteIds: ["ana", "cata"], position: 1, tieSize: 1 },
      { athleteIds: ["bea", "dani"], position: 2, tieSize: 1 },
    ],
  };

  it("cada jugador recibe la mitad de los puntos de su dupla", () => {
    const r = buildRanking([etapa1]);
    expect(r.map((x) => [x.athleteId, x.points])).toEqual([
      ["ana", 100],
      ["bea", 100],
      ["cata", 90],
      ["dani", 90],
    ]);
  });

  it("los puntos se acumulan por jugador aunque cambien de pareja", () => {
    const r = buildRanking([etapa1, etapa2]);
    const pts = Object.fromEntries(r.map((x) => [x.athleteId, x.points]));
    expect(pts).toEqual({ ana: 200, bea: 190, cata: 190, dani: 180 });
    expect(r.find((x) => x.athleteId === "bea")!.rank).toBe(2);
    expect(r.find((x) => x.athleteId === "cata")!.rank).toBe(2); // empate en puntos → mismo puesto
    expect(r.find((x) => x.athleteId === "dani")!.rank).toBe(4);
  });

  it("una dupla nueva suma los puntos de sus dos jugadores", () => {
    const r = buildRanking([etapa1, etapa2]);
    const map = new Map(r.map((x) => [x.athleteId, x.points]));
    expect(teamPoints(map, ["bea", "cata"])).toBe(380);
    expect(teamPoints(map, ["dani", "nueva"])).toBe(180); // jugadora sin puntos aporta 0
  });

  it("los jugadores de una ficha sin vincular (null) no reciben puntos", () => {
    const r = buildRanking([{ ...etapa1, teams: [{ athleteIds: ["ana", null], position: 1, tieSize: 1 }] }]);
    expect(r).toHaveLength(1);
    expect(r[0].points).toBe(100);
  });
});

describe("validación de tablas", () => {
  it("acepta la tabla nacional", () => expect(tableIssues(NACIONAL)).toEqual([]));
  it("detecta superposición y rangos inválidos", () => {
    expect(tableIssues([{ from: 1, to: 4, points: 100 }, { from: 3, to: 5, points: 50 }])).toHaveLength(1);
    expect(tableIssues([{ from: 5, to: 2, points: 10 }])).toHaveLength(1);
    expect(tableIssues([])).toHaveLength(1);
  });
});
