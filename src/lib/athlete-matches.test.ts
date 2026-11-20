import { describe, expect, it } from "vitest";
import type { TournamentState } from "@/lib/engine";
import { teamMatches } from "./athlete-matches";

const match = (o: Record<string, unknown>) => ({
  stageKey: "g",
  round: 1,
  bracket: "main",
  a: null,
  b: null,
  winner: null,
  loser: null,
  ...o,
});

const state = {
  matches: [
    match({ key: "m1", number: 1, label: "Grupo A", teamA: "T", teamB: "R1", status: "finished", winner: "T",
      result: { sets: [{ a: 21, b: 18 }, { a: 19, b: 21 }, { a: 15, b: 12 }] } }),
    match({ key: "m2", number: 2, label: "Grupo A", teamA: "R2", teamB: "T", status: "finished", winner: "R2",
      result: { sets: [{ a: 21, b: 10 }, { a: 21, b: 12 }] } }),
    match({ key: "m3", number: 3, label: "Grupo A", teamA: "T", teamB: "R3", status: "ready" }),
    match({ key: "m4", number: 4, label: "Cuartos", teamA: "T", teamB: null, status: "undefined" }),
    match({ key: "m5", number: 5, label: "Grupo B", teamA: "X", teamB: "Y", status: "ready" }),
    match({ key: "m6", number: 6, label: "Grupo A", teamA: "T", teamB: "R4", status: "cancelled" }),
    match({ key: "m7", number: 7, label: "Grupo A", teamA: "R5", teamB: "T", status: "finished", winner: "T",
      result: { sets: [], walkoverWinner: "b" } }),
  ],
} as unknown as TournamentState;

const schedule = {
  m1: { court: "1", scheduled_at: "2026-11-20T14:00:00.000Z" },
  m2: { court: "1", scheduled_at: "2026-11-20T15:00:00.000Z" },
  m3: { court: "2", scheduled_at: "2026-11-21T14:00:00.000Z" },
};

describe("teamMatches", () => {
  const r = teamMatches(state, "T", schedule);

  it("separa los que faltan (por hora, sin hora al final) de los jugados", () => {
    expect(r.upcoming.map((m) => m.key)).toEqual(["m3", "m4"]);
    expect(r.upcoming[0]).toMatchObject({ opponent: "R3", court: "2" });
    expect(r.upcoming[1].opponent).toBeNull();
  });

  it("muestra el marcador desde el lado de la dupla y cuenta G–P", () => {
    const m1 = r.played.find((m) => m.key === "m1")!;
    const m2 = r.played.find((m) => m.key === "m2")!;
    expect(m1).toMatchObject({ won: true, score: "21-18, 19-21, 15-12", opponent: "R1" });
    expect(m2).toMatchObject({ won: false, score: "10-21, 12-21", opponent: "R2" });
    expect(r.played.find((m) => m.key === "m7")).toMatchObject({ won: true, walkover: true, score: null });
    expect([r.wins, r.losses]).toEqual([2, 1]);
  });

  it("ignora partidos ajenos y cancelados; sin formato no hay partidos", () => {
    const keys = [...r.upcoming, ...r.played].map((m) => m.key);
    expect(keys).not.toContain("m5");
    expect(keys).not.toContain("m6");
    expect(teamMatches(null, "T", {})).toEqual({ upcoming: [], played: [], wins: 0, losses: 0 });
  });
});
