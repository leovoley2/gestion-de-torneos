import { describe, expect, it } from "vitest";
import {
  ageOn,
  eligibilityIssues,
  isMinor,
  needsGuardianConsent,
  profileIssues,
  registrationClosedReason,
  type Athlete,
  type CategoryRules,
} from "./athletes";

const athlete = (over: Partial<Athlete> = {}): Athlete => ({
  id: "a",
  email: "a@x.pe",
  email_verified_at: null,
  first_name: "Ana",
  last_name: "Torres",
  document_type: "DNI",
  document_number: "12345678",
  birthdate: "1998-05-10",
  gender: "F",
  phone: "999111222",
  city: null,
  club: null,
  guardian_name: null,
  guardian_document: null,
  guardian_phone: null,
  guardian_relationship: null,
  ...over,
});

const rules = (over: Partial<CategoryRules> = {}): CategoryRules => ({
  gender: "F",
  registration_open: true,
  registration_deadline: null,
  min_birth_year: null,
  max_birth_year: null,
  has_format: false,
  ...over,
});

describe("edad y menores", () => {
  it("cuenta la edad cumplida (el día del cumpleaños ya cumple)", () => {
    expect(ageOn("2008-11-20", "2026-11-19")).toBe(17);
    expect(ageOn("2008-11-20", "2026-11-20")).toBe(18);
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
  });
  it("es menor según la fecha del torneo, no la de hoy", () => {
    const a = athlete({ birthdate: "2008-11-25" });
    expect(isMinor(a, "2026-11-20")).toBe(true);
    expect(isMinor(a, "2026-12-01")).toBe(false);
  });
  it("sin fecha de nacimiento no se considera menor", () => {
    expect(isMinor(athlete({ birthdate: null }), "2026-11-20")).toBe(false);
  });
});

describe("perfil completo", () => {
  it("un adulto con sus datos está completo", () => {
    expect(profileIssues(athlete(), "2026-11-20")).toEqual([]);
  });
  it("un menor necesita los datos del apoderado", () => {
    const issues = profileIssues(athlete({ birthdate: "2010-01-01" }), "2026-11-20");
    expect(issues).toEqual(["nombre del apoderado", "documento del apoderado", "teléfono del apoderado", "parentesco del apoderado"]);
  });
  it("lista lo que falta", () => {
    expect(profileIssues(athlete({ document_number: " ", gender: null, phone: null }))).toEqual([
      "número de documento",
      "sexo",
      "teléfono",
    ]);
  });
});

describe("inscripciones abiertas", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("abierta y publicada", () => expect(registrationClosedReason(rules(), true, now)).toBeNull());
  it("torneo sin publicar", () => expect(registrationClosedReason(rules(), false, now)).toMatch(/publicado/));
  it("cerrada", () => expect(registrationClosedReason(rules({ registration_open: false }), true, now)).toMatch(/cerradas/));
  it("plazo vencido", () =>
    expect(registrationClosedReason(rules({ registration_deadline: "2026-11-09T23:59:00Z" }), true, now)).toMatch(/venció/));
  it("formato ya generado", () => expect(registrationClosedReason(rules({ has_format: true }), true, now)).toMatch(/grupos/));
});

describe("elegibilidad de la dupla", () => {
  const f1 = athlete({ id: "f1", gender: "F" });
  const f2 = athlete({ id: "f2", gender: "F" });
  const m1 = athlete({ id: "m1", gender: "M", first_name: "Luis" });
  it("rama femenina, masculina y mixta", () => {
    expect(eligibilityIssues(rules({ gender: "F" }), f1, f2)).toEqual([]);
    expect(eligibilityIssues(rules({ gender: "F" }), f1, m1)).toHaveLength(1);
    expect(eligibilityIssues(rules({ gender: "M" }), m1, f1)).toHaveLength(1);
    expect(eligibilityIssues(rules({ gender: "X" }), f1, m1)).toEqual([]);
    expect(eligibilityIssues(rules({ gender: "X" }), f1, f2)).toHaveLength(1);
  });
  it("años de nacimiento (p. ej. Sub-19: nacidos desde 2008)", () => {
    const young = athlete({ id: "y", birthdate: "2009-03-01" });
    const old = athlete({ id: "o", birthdate: "2006-03-01", first_name: "Rosa", last_name: "Núñez" });
    expect(eligibilityIssues(rules({ min_birth_year: 2008 }), young, young)).toEqual([]);
    expect(eligibilityIssues(rules({ min_birth_year: 2008 }), young, old)).toEqual(["Rosa Núñez nació antes de 2008"]);
    expect(eligibilityIssues(rules({ max_birth_year: 2000 }), young, f1)).toHaveLength(1);
  });
});

describe("autorización del apoderado (menores de 14)", () => {
  const guardian = { guardian_name: "Rosa", guardian_document: "1", guardian_phone: "9", guardian_relationship: "Madre" };
  it("se pide solo a menores de 14 años", () => {
    expect(needsGuardianConsent({ birthdate: "2014-01-01", guardian_consent_at: null }, "2026-11-20")).toBe(true);
    expect(needsGuardianConsent({ birthdate: "2012-11-20", guardian_consent_at: null }, "2026-11-20")).toBe(false);
    expect(needsGuardianConsent({ birthdate: null, guardian_consent_at: null }, "2026-11-20")).toBe(false);
  });
  it("sin autorización el perfil queda incompleto", () => {
    const kid = athlete({ birthdate: "2016-03-01", ...guardian });
    expect(profileIssues(kid)).toContain("autorización del apoderado");
    expect(profileIssues({ ...kid, guardian_consent_at: "2026-11-20" })).not.toContain("autorización del apoderado");
    expect(profileIssues(athlete({ birthdate: "2010-03-01", ...guardian }))).not.toContain("autorización del apoderado");
  });
});
