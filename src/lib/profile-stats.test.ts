import { describe, expect, it } from "vitest";
import type { TeamMatch } from "./athlete-matches";
import { byYear, initials, profileStats, type ProfileParticipation } from "./profile-stats";

const match = (number: number, won: boolean, at: string | null): TeamMatch => ({
  key: `m${number}`, number, label: "", opponent: "x", status: "finished", scheduledAt: at, court: null, score: "21-10", won, walkover: false,
});
const part = (o: Partial<ProfileParticipation> & { played?: TeamMatch[] }): ProfileParticipation => {
  const played = o.played ?? [];
  return {
    teamId: Math.random().toString(),
    partner: { id: "p1", name: "Mia Flores" },
    tournament: { start_date: "2026-11-20" },
    position: null,
    ...o,
    record: { played, wins: played.filter((m) => m.won).length, losses: played.filter((m) => !m.won).length },
  };
};

describe("perfil del atleta", () => {
  it("iniciales", () => {
    expect(initials("Ana Torres")).toBe("AT");
    expect(initials("María José de la Cruz")).toBe("MC");
    expect(initials("lía")).toBe("L");
    expect(initials("  ")).toBe("?");
  });

  it("resumen: victorias, mejor puesto, medallas, racha y parejas", () => {
    const s = profileStats([
      part({ position: 1, played: [match(1, true, "2026-11-20T15:00:00Z"), match(2, true, "2026-11-20T17:00:00Z")] }),
      part({ position: 3, partner: { id: "p2", name: "Bea Salas" }, tournament: { start_date: "2026-10-01" }, played: [match(1, false, "2026-10-01T15:00:00Z")] }),
      part({ position: 3 }),
      part({ position: null, partner: { id: null, name: "Sin Cuenta" } }),
    ]);
    expect(s).toMatchObject({ tournaments: 4, wins: 2, losses: 1, best: 1, medals: { gold: 1, silver: 0, bronze: 2 } });
    expect(s.winRate).toBeCloseTo(2 / 3);
    expect(s.form).toEqual([true, true, false]); // el más reciente primero
    expect(s.partners[0]).toMatchObject({ id: "p1", count: 2 });
    expect(s.partners).toHaveLength(3);
  });

  it("sin partidos no hay porcentaje", () => {
    expect(profileStats([part({})]).winRate).toBeNull();
  });

  it("agrupa por año, el más reciente primero", () => {
    const groups = byYear([
      { tournament: { start_date: "2025-05-01" } },
      { tournament: { start_date: null } },
      { tournament: { start_date: "2026-01-01" } },
    ]);
    expect(groups.map((g) => g.year)).toEqual(["2026", "2025", "Sin fecha"]);
  });
});
