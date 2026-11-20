import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ sql: () => Promise.resolve([]) }));
const { buildTasks, progressOf } = await import("./admin-dashboard");
type Cat = Parameters<typeof buildTasks>[2][number];
type Tour = Parameters<typeof buildTasks>[1][number];

const T1 = "11111111-1111-1111-1111-111111111111";
const T2 = "22222222-2222-2222-2222-222222222222";
const now = new Date("2026-11-20T15:00:00Z");

const cat = (o: Partial<Cat>): Cat => ({
  id: "c",
  tournament_id: T1,
  tournament_name: "Etapa 1",
  name: "Open",
  gender: "F",
  status: "setup",
  registration_open: false,
  teams: 0,
  has_format: false,
  matches: 0,
  results: 0,
  pending_reviews: 0,
  today_pending: 0,
  ...o,
});
const tour = (o: Partial<Tour>): Tour => ({
  id: T1,
  name: "Etapa 1",
  city: null,
  start_date: null,
  end_date: null,
  published: true,
  phase: "upcoming",
  categories: 1,
  teams: 0,
  matches: 0,
  results: 0,
  pending_reviews: 0,
  ...o,
});
const superadmin = [{ role: "superadmin" as const, tournament_id: null }];

describe("pendientes del panel", () => {
  it("inscripciones por revisar y partidos de hoy van primero", () => {
    const tasks = buildTasks(
      superadmin,
      [tour({})],
      [
        cat({ teams: 4 }),
        cat({ id: "d", pending_reviews: 2, today_pending: 1 }),
      ],
      now,
    );
    expect(tasks.map((t) => t.kind)).toEqual(["review", "today", "format"]);
    expect(tasks[0].title).toBe("2 inscripciones por revisar");
    expect(tasks[0].href).toBe("/admin/categorias/d#inscripciones");
  });

  it("cada rol solo ve lo que puede hacer, y solo en su torneo", () => {
    const cats = [
      cat({ teams: 4, pending_reviews: 1, today_pending: 3 }),
      cat({ id: "x", tournament_id: T2, today_pending: 1 }),
    ];
    const mesa = buildTasks(
      [{ role: "results", tournament_id: T1 }],
      [tour({})],
      cats,
      now,
    );
    expect(mesa.map((t) => t.kind)).toEqual(["today"]);
    const inscripciones = buildTasks(
      [{ role: "registrations", tournament_id: null }],
      [tour({})],
      cats,
      now,
    );
    expect(inscripciones.map((t) => t.kind)).toEqual(["review"]);
  });

  it("avisa de un borrador que empieza pronto, no de uno lejano ni de uno publicado", () => {
    const tours = [
      tour({ published: false, start_date: "2026-11-21" }),
      tour({ id: T2, published: false, start_date: "2027-03-01" }),
      tour({ id: "p", published: true, start_date: "2026-11-21" }),
    ];
    const tasks = buildTasks(superadmin, tours, [], now);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ kind: "publish", urgent: true });
    expect(tasks[0].detail).toMatch(/empieza mañana/);
  });

  it("no pide formato en un torneo terminado", () => {
    expect(
      buildTasks(
        superadmin,
        [tour({ phase: "past" })],
        [cat({ teams: 4 })],
        now,
      ),
    ).toEqual([]);
  });

  it("avance: terminada = 100 %, si no resultados / partidos", () => {
    expect(progressOf({ status: "finished", matches: 10, results: 7 })).toBe(1);
    expect(progressOf({ status: "in_progress", matches: 10, results: 5 })).toBe(
      0.5,
    );
    expect(progressOf({ status: "setup", matches: 0, results: 0 })).toBe(0);
  });
});
