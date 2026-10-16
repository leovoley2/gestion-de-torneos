// Formatos de fecha legibles en español. Las fechas de torneo llegan como texto AAAA-MM-DD.

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const parts = (d: string) => {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return { y, m, day };
};

/** "20–22 nov 2026", "30 nov – 2 dic 2026", "20 nov 2026" o null. */
export function formatRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const a = parts((start ?? end)!);
  const b = parts((end ?? start)!);
  if (a.y === b.y && a.m === b.m && a.day === b.day) return `${a.day} ${MONTHS[a.m - 1]} ${a.y}`;
  if (a.y === b.y && a.m === b.m) return `${a.day}–${b.day} ${MONTHS[a.m - 1]} ${a.y}`;
  if (a.y === b.y) return `${a.day} ${MONTHS[a.m - 1]} – ${b.day} ${MONTHS[b.m - 1]} ${a.y}`;
  return `${a.day} ${MONTHS[a.m - 1]} ${a.y} – ${b.day} ${MONTHS[b.m - 1]} ${b.y}`;
}

export type Phase = "upcoming" | "live" | "past" | "unknown";

/** Momento del torneo según sus fechas (hora de Lima). */
export function tournamentPhase(start: string | null, end: string | null, now = new Date()): Phase {
  if (!start && !end) return "unknown";
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/Lima" }); // AAAA-MM-DD
  if (start && today < start.slice(0, 10)) return "upcoming";
  if (end && today > end.slice(0, 10)) return "past";
  return "live";
}

export const PHASE_LABEL: Record<Phase, string> = {
  upcoming: "Próximamente",
  live: "En curso",
  past: "Finalizado",
  unknown: "",
};
