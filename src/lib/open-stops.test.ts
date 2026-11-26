import { describe, expect, it } from "vitest";
import { openStopsFor, type OpenCategoryLike } from "./open-stops";

const cat = (o: Partial<OpenCategoryLike>): OpenCategoryLike => ({
  id: "c", name: "Open", gender: "F", min_birth_year: null, max_birth_year: null, max_teams: null, accepted: 0,
  registration_deadline: null, registration_fee: null, payment_instructions: null,
  tournament_id: "t1", tournament_name: "Parada 1", tournament_city: "Lima", start_date: "2026-12-12", end_date: "2026-12-14",
  ...o,
});

describe("paradas abiertas para un atleta", () => {
  const me = { gender: "F" as const, birthdate: "2006-04-02" };

  it("marca inscrito, abierta, llena y no corresponde; agrupa por parada", () => {
    const stops = openStopsFor(
      [
        cat({ id: "a", name: "Adulto F" }),
        cat({ id: "b", name: "Adulto M", gender: "M" }),
        cat({ id: "c", name: "U21 F", min_birth_year: 2008 }),
        cat({ id: "d", name: "Llena", max_teams: 4, accepted: 4 }),
        cat({ id: "e", name: "Otra parada", tournament_id: "t2", tournament_name: "Parada 2", start_date: "2026-12-01", registration_deadline: "2026-11-30T12:00:00Z" }),
      ],
      [{ id: "r1", status: "pending_partner", category: { id: "e" } }, { id: "r0", status: "withdrawn", category: { id: "a" } }],
      me,
    );
    expect(stops.map((s) => s.name)).toEqual(["Parada 1", "Parada 2"]); // la 1 tiene categorías abiertas para ella
    const p1 = stops[0];
    expect(p1.canJoin).toBe(true);
    expect(p1.categories.map((c) => [c.category.id, c.state.kind])).toEqual([
      ["a", "open"], // la inscripción retirada no cuenta
      ["d", "full"],
      ["b", "not_for_you"],
      ["c", "not_for_you"],
    ]);
    expect(stops[1].categories[0].state).toEqual({ kind: "registered", registrationId: "r1", status: "pending_partner" });
    expect(stops[1].canJoin).toBe(false);
    expect(stops[1].closesAt).toBe("2026-11-30T12:00:00Z");
  });

  it("orden: puede inscribirse → ya inscrita → no le corresponde", () => {
    const stops = openStopsFor(
      [
        cat({ id: "x", tournament_id: "nada", tournament_name: "Nada", gender: "M", start_date: "2026-11-01" }),
        cat({ id: "y", tournament_id: "inscrita", tournament_name: "Inscrita", start_date: "2026-12-30" }),
        cat({ id: "z", tournament_id: "abierta", tournament_name: "Abierta", start_date: "2027-01-15" }),
      ],
      [{ id: "r", status: "pending_review", category: { id: "y" } }],
      me,
    );
    expect(stops.map((s) => s.name)).toEqual(["Abierta", "Inscrita", "Nada"]);
  });
});
