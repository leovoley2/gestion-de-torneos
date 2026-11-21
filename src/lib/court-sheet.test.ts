import { describe, expect, it } from "vitest";
import { NO_COURT, groupByDayAndCourt, type SheetMatch } from "./court-sheet";

const m = (o: Partial<SheetMatch>): SheetMatch => ({
  key: Math.random().toString(),
  categoryName: "Open",
  number: 1,
  label: "Grupo A",
  teamA: "A",
  teamB: "B",
  court: null,
  scheduledAt: null,
  score: null,
  ...o,
});

describe("hoja por cancha", () => {
  it("agrupa por día (Lima) y cancha, ordena canchas con números y partidos por hora", () => {
    const days = groupByDayAndCourt([
      m({ number: 3, court: "Cancha 10", scheduledAt: "2026-11-22T15:00:00Z" }),
      m({ number: 1, court: "Cancha 2", scheduledAt: "2026-11-22T16:00:00Z" }),
      m({ number: 2, court: "Cancha 2", scheduledAt: "2026-11-22T14:00:00Z" }),
      // 02:00 UTC del 23 = 21:00 del 22 en Lima
      m({ number: 4, court: "Cancha 2", scheduledAt: "2026-11-23T02:00:00Z" }),
      m({ number: 5, court: "Cancha 1", scheduledAt: "2026-11-23T14:00:00Z" }),
      m({ number: 6 }),
    ]);
    expect(days.map((d) => d.day)).toEqual(["2026-11-22", "2026-11-23", ""]);
    expect(days[0].courts.map((c) => c.court)).toEqual(["Cancha 2", "Cancha 10"]);
    expect(days[0].courts[0].matches.map((x) => x.number)).toEqual([2, 1, 4]);
    expect(days[2].courts[0].court).toBe(NO_COURT);
  });
});
