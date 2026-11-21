// Hoja de partidos por cancha (para árbitros y mesa): agrupación pura, sin base de datos.

export interface SheetMatch {
  key: string;
  categoryName: string;
  number: number;
  label: string;
  teamA: string;
  teamB: string;
  court: string | null;
  scheduledAt: string | null; // ISO
  score: string | null; // marcador si ya se jugó
}

export interface CourtGroup {
  court: string; // "Sin cancha asignada" si no tiene
  matches: SheetMatch[];
}

export interface DayGroup {
  day: string; // AAAA-MM-DD (Lima) o "" = sin horario
  courts: CourtGroup[];
}

const TZ = "America/Lima";
export const NO_COURT = "Sin cancha asignada";
export const dayOf = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ }) : "");

/** Ordena canchas como personas: "Cancha 2" antes que "Cancha 10"; las sin cancha al final. */
const courtOrder = (a: string, b: string) =>
  a === NO_COURT ? 1 : b === NO_COURT ? -1 : a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });

/** Agrupa por día y por cancha; dentro de cada cancha, por hora (los sin hora al final, por número). */
export function groupByDayAndCourt(matches: SheetMatch[]): DayGroup[] {
  const days = new Map<string, Map<string, SheetMatch[]>>();
  for (const m of matches) {
    const day = dayOf(m.scheduledAt);
    const court = m.court?.trim() || NO_COURT;
    if (!days.has(day)) days.set(day, new Map());
    const courts = days.get(day)!;
    if (!courts.has(court)) courts.set(court, []);
    courts.get(court)!.push(m);
  }
  return [...days.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    .map(([day, courts]) => ({
      day,
      courts: [...courts.entries()]
        .sort(([a], [b]) => courtOrder(a, b))
        .map(([court, list]) => ({
          court,
          matches: list.sort((x, y) => {
            if (x.scheduledAt && y.scheduledAt && x.scheduledAt !== y.scheduledAt) return x.scheduledAt < y.scheduledAt ? -1 : 1;
            if (Boolean(x.scheduledAt) !== Boolean(y.scheduledAt)) return x.scheduledAt ? -1 : 1;
            return x.categoryName.localeCompare(y.categoryName) || x.number - y.number;
          }),
        })),
    }));
}
