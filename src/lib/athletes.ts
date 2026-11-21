// Reglas puras sobre atletas e inscripciones (sin base de datos: se pueden probar a fondo).

export interface Athlete {
  id: string;
  email: string | null; // null = ficha creada por la organización (sin cuenta)
  email_verified_at: Date | string | null;
  first_name: string;
  last_name: string;
  document_type: "DNI" | "CE" | "PASAPORTE";
  document_number: string | null;
  birthdate: string | null; // AAAA-MM-DD
  gender: "F" | "M" | null;
  phone: string | null;
  city: string | null;
  club: string | null;
  guardian_name: string | null;
  guardian_document: string | null;
  guardian_phone: string | null;
  guardian_relationship: string | null;
  privacy_accepted_at?: Date | string | null;
  privacy_version?: string | null;
  guardian_consent_at?: Date | string | null;
}

export const DOCUMENT_TYPES = { DNI: "DNI", CE: "Carné de extranjería", PASAPORTE: "Pasaporte" } as const;
export const ADULT_AGE = 18;
/** Menores de esta edad necesitan la autorización del apoderado para el tratamiento de sus datos (Ley 29733). */
export const CONSENT_AGE = 14;

/** ¿Hace falta (y falta) la autorización del apoderado? Menores de 14 años, hoy. */
export function needsGuardianConsent(a: Pick<Athlete, "birthdate" | "guardian_consent_at">, today = todayLima()): boolean {
  return Boolean(a.birthdate) && ageOn(a.birthdate!, today) < CONSENT_AGE;
}

export const fullName = (a: Pick<Athlete, "first_name" | "last_name">) => `${a.first_name} ${a.last_name}`.trim();

/** Edad cumplida en una fecha (ambas AAAA-MM-DD). */
export function ageOn(birthdate: string, date: string): number {
  const [by, bm, bd] = birthdate.slice(0, 10).split("-").map(Number);
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export const todayLima = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "America/Lima" });

/** ¿Es menor de edad en la fecha del torneo (o hoy, si no hay fecha)? */
export function isMinor(a: Pick<Athlete, "birthdate">, onDate?: string | null): boolean {
  if (!a.birthdate) return false;
  return ageOn(a.birthdate, onDate ?? todayLima()) < ADULT_AGE;
}

/** Campos que faltan para que el perfil esté completo (vacío = completo). */
export function profileIssues(a: Athlete, onDate?: string | null): string[] {
  const missing: string[] = [];
  if (!a.first_name.trim() || !a.last_name.trim()) missing.push("nombres y apellidos");
  if (!a.document_number?.trim()) missing.push("número de documento");
  if (!a.birthdate) missing.push("fecha de nacimiento");
  if (!a.gender) missing.push("sexo");
  if (!a.phone?.trim()) missing.push("teléfono");
  if (isMinor(a, onDate)) {
    if (!a.guardian_name?.trim()) missing.push("nombre del apoderado");
    if (!a.guardian_document?.trim()) missing.push("documento del apoderado");
    if (!a.guardian_phone?.trim()) missing.push("teléfono del apoderado");
    if (!a.guardian_relationship?.trim()) missing.push("parentesco del apoderado");
    if (needsGuardianConsent(a) && !a.guardian_consent_at) missing.push("autorización del apoderado");
  }
  return missing;
}

export interface CategoryRules {
  gender: "F" | "M" | "X";
  registration_open: boolean;
  registration_deadline: Date | string | null;
  min_birth_year: number | null;
  max_birth_year: number | null;
  has_format: boolean; // con el formato generado ya no entran más duplas
}

/** ¿La categoría acepta inscripciones ahora? Devuelve el motivo si no. */
export function registrationClosedReason(c: CategoryRules, published: boolean, now = new Date()): string | null {
  if (!published) return "El torneo no está publicado";
  if (!c.registration_open) return "Las inscripciones de esta categoría están cerradas";
  if (c.registration_deadline && new Date(c.registration_deadline) < now) return "El plazo de inscripción ya venció";
  if (c.has_format) return "La categoría ya armó sus grupos y llaves";
  return null;
}

/** Problemas para que una dupla juegue la categoría (rama y años de nacimiento). */
export function eligibilityIssues(c: CategoryRules, a: Athlete, b: Athlete): string[] {
  const issues: string[] = [];
  const name = (x: Athlete) => fullName(x) || x.email;
  if (c.gender === "F" && (a.gender !== "F" || b.gender !== "F")) issues.push("La categoría femenina es para dos jugadoras");
  if (c.gender === "M" && (a.gender !== "M" || b.gender !== "M")) issues.push("La categoría masculina es para dos jugadores");
  if (c.gender === "X" && !((a.gender === "F" && b.gender === "M") || (a.gender === "M" && b.gender === "F"))) {
    issues.push("La categoría mixta es para una jugadora y un jugador");
  }
  for (const x of [a, b]) {
    const year = x.birthdate ? Number(x.birthdate.slice(0, 4)) : null;
    if (year === null) continue;
    if (c.min_birth_year && year < c.min_birth_year) issues.push(`${name(x)} nació antes de ${c.min_birth_year}`);
    if (c.max_birth_year && year > c.max_birth_year) issues.push(`${name(x)} nació después de ${c.max_birth_year}`);
  }
  return issues;
}

export const REGISTRATION_STATUS = {
  pending_partner: { label: "Esperando al compañero", tone: "wait" },
  pending_review: { label: "En revisión", tone: "wait" },
  accepted: { label: "Aceptada", tone: "ok" },
  rejected: { label: "Rechazada", tone: "bad" },
  declined: { label: "El compañero no aceptó", tone: "bad" },
  withdrawn: { label: "Retirada", tone: "off" },
} as const;
export type RegistrationStatus = keyof typeof REGISTRATION_STATUS;
export const ACTIVE_STATUSES: RegistrationStatus[] = ["pending_partner", "pending_review", "accepted"];
