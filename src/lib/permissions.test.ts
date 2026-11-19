import { describe, expect, it } from "vitest";
import { can, visibleTournaments, type RoleGrant } from "./permissions";

const T1 = "t1";
const T2 = "t2";
const g = (role: RoleGrant["role"], tournament_id: string | null = null): RoleGrant => ({ role, tournament_id });

describe("permisos del equipo", () => {
  it("el administrador general puede todo", () => {
    for (const p of ["staff.manage", "ranking.manage", "tournament.create", "tournament.edit", "results.edit"] as const) {
      expect(can([g("superadmin")], p, T1)).toBe(true);
    }
  });

  it("sin roles no puede nada", () => {
    expect(can([], "results.edit", T1)).toBe(false);
  });

  it("la mesa de resultados solo carga resultados", () => {
    const mesa = [g("results")];
    expect(can(mesa, "results.edit", T1)).toBe(true);
    expect(can(mesa, "tournament.edit", T1)).toBe(false);
    expect(can(mesa, "registrations.review", T1)).toBe(false);
    expect(can(mesa, "staff.manage")).toBe(false);
  });

  it("un rol de un torneo no sirve para otro", () => {
    const org = [g("organizer", T1)];
    expect(can(org, "tournament.edit", T1)).toBe(true);
    expect(can(org, "tournament.edit", T2)).toBe(false);
    expect(can(org, "results.edit", T2)).toBe(false);
  });

  it("crear torneos, equipo y ranking exigen rol global", () => {
    expect(can([g("organizer", T1)], "tournament.create")).toBe(false);
    expect(can([g("organizer")], "tournament.create")).toBe(true);
    expect(can([g("organizer")], "staff.manage")).toBe(false);
    expect(can([g("organizer")], "ranking.manage")).toBe(false);
  });

  it("inscripciones: revisa y atiende atletas, no edita torneos", () => {
    const insc = [g("registrations", T1)];
    expect(can(insc, "registrations.review", T1)).toBe(true);
    expect(can(insc, "registrations.review", T2)).toBe(false);
    expect(can(insc, "athletes.support")).toBe(true);
    expect(can(insc, "tournament.edit", T1)).toBe(false);
  });

  it("torneos visibles en el panel", () => {
    expect(visibleTournaments([g("results")])).toBeNull();
    expect(visibleTournaments([g("results", T1), g("registrations", T2), g("organizer", T1)])?.sort()).toEqual([T1, T2]);
  });
});
