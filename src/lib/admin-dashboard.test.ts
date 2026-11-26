import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ sql: () => Promise.resolve([]) }));
const { buildTasks, progressOf, archiveCutoff, summarize } = await import("./admin-dashboard");
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
  registration_expired: false,
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

describe("archivo", () => {
  it("el corte es 90 días antes de hoy (hora de Lima)", () => {
    expect(archiveCutoff(now)).toBe("2026-08-22");
    // 02:00 UTC del 1 de enero todavía es 31 de diciembre en Lima.
    expect(archiveCutoff(new Date("2027-01-01T02:00:00Z"))).toBe("2026-10-02");
  });

  it("suma las categorías de cada torneo y deduce el estado si no tiene fechas", () => {
    const row = { id: T1, name: "Etapa 1", city: null, start_date: null, end_date: null, published: true };
    const [t] = summarize(
      [row],
      [
        cat({ id: "a", status: "finished", teams: 8, matches: 12, results: 12 }),
        cat({ id: "b", status: "in_progress", teams: 6, matches: 9, results: 4, pending_reviews: 1 }),
        cat({ id: "c", tournament_id: T2, teams: 99 }),
      ],
      now,
    );
    expect(t).toMatchObject({ phase: "live", categories: 2, teams: 14, matches: 21, results: 16, pending_reviews: 1 });
    expect(summarize([{ ...row, end_date: "2026-11-01" }], [], now)[0].phase).toBe("past");
  });
});

describe("aviso de correos", () => {
  it("solo el administrador general lo ve, y va primero", () => {
    const sa = [{ role: "superadmin" as const, tournament_id: null }];
    const org = [{ role: "organizer" as const, tournament_id: null }];
    const tasks = buildTasks(sa, [], [cat({ teams: 4 })], now, false);
    expect(tasks[0]).toMatchObject({ kind: "email", urgent: true, href: "/admin/correos" });
    expect(buildTasks(org, [], [], now, false).some((t) => t.kind === "email")).toBe(false);
    expect(buildTasks(sa, [], [], now, true).some((t) => t.kind === "email")).toBe(false);
  });
});
