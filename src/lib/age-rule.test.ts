import { describe, expect, it } from "vitest";
import { ageRuleSentence, ageRuleShort, seasonYear, underYear } from "./age-rule";

const rule = (min: number | null, max: number | null) => ({ min_birth_year: min, max_birth_year: max });

describe("regla de edad", () => {
  it("sin años es edad libre", () => {
    expect(ageRuleShort(rule(null, null))).toBe("Edad libre");
    expect(ageRuleSentence(rule(null, null), 2026)).toBe("Cualquier edad puede inscribirse.");
  });

  it("traduce los años a edades de la temporada", () => {
    expect(ageRuleSentence(rule(2006, 2014), 2026)).toBe(
      "Pueden inscribirse nacidos entre 2006 y 2014 (de 12 a 20 años en 2026).",
    );
    expect(ageRuleSentence(rule(2007, null), 2026)).toBe("Pueden inscribirse nacidos en 2007 o después (hasta 19 años en 2026).");
    expect(ageRuleShort(rule(2006, 2014))).toBe("Nacidos 2006–2014");
  });

  it("U21 en 2026 son los nacidos desde 2006", () => {
    expect(underYear(21, 2026)).toBe(2006);
    expect(underYear(17, 2026)).toBe(2010);
  });

  it("toma el año del torneo o el actual", () => {
    expect(seasonYear("2027-01-15")).toBe(2027);
    expect(seasonYear(null, new Date("2026-11-27T12:00:00Z"))).toBe(2026);
  });
});
