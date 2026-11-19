// Cálculo del ranking (lógica pura, sin base de datos).
//
// Reglas del circuito:
// - Cada puesto final otorga puntos a la DUPLA según la tabla del torneo.
// - Si varias duplas empatan en un puesto (p. ej. cuatro 5º), reciben el promedio de los puntos de
//   los puestos que ocupan (5º a 8º).
// - Los puntos de la dupla se dividen por la mitad: cada jugador suma su parte en su ranking individual.
// - Los puntos de una dupla nueva = suma de los puntos individuales de sus dos jugadores (aunque
//   antes hayan jugado con otras personas). Eso ordena la siembra.

export interface PointRow {
  from: number;
  to: number;
  points: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Puntos para mostrar: enteros sin decimales, el resto con uno (p. ej. 75 o 62.5). */
export const formatPoints = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Puntos de un puesto según la tabla (0 si la tabla no llega a ese puesto). */
export function pointsAt(table: PointRow[], position: number): number {
  return table.find((r) => position >= r.from && position <= r.to)?.points ?? 0;
}

/** Puntos de la dupla: promedio de los puestos que ocupa el empate (posición … posición + empate − 1). */
export function pairPointsFor(table: PointRow[], position: number, tieSize: number): number {
  let total = 0;
  for (let p = position; p < position + Math.max(tieSize, 1); p++) total += pointsAt(table, p);
  return round1(total / Math.max(tieSize, 1));
}

export interface CategoryResult {
  categoryId: string;
  label: string; // "Etapa Máncora · Open"
  date: string | null;
  teams: { athleteIds: [string | null, string | null]; position: number; tieSize: number }[];
  table: PointRow[];
}

export interface Award {
  athleteId: string;
  categoryId: string;
  label: string;
  date: string | null;
  position: number;
  points: number; // ya dividido entre los dos jugadores
}

/** Puntos individuales que reparte una categoría terminada. */
export function awardsFor(c: CategoryResult): Award[] {
  const out: Award[] = [];
  for (const t of c.teams) {
    const each = round1(pairPointsFor(c.table, t.position, t.tieSize) / 2);
    for (const athleteId of t.athleteIds) {
      if (athleteId) out.push({ athleteId, categoryId: c.categoryId, label: c.label, date: c.date, position: t.position, points: each });
    }
  }
  return out;
}

export interface RankingRow {
  athleteId: string;
  points: number;
  events: number;
  best: number | null; // mejor puesto
  rank: number; // empatados en puntos comparten puesto
  awards: Award[];
}

/** Ranking individual: suma de puntos de todas las categorías; empates comparten puesto. */
export function buildRanking(results: CategoryResult[]): RankingRow[] {
  const byAthlete = new Map<string, Award[]>();
  for (const c of results) {
    for (const a of awardsFor(c)) byAthlete.set(a.athleteId, [...(byAthlete.get(a.athleteId) ?? []), a]);
  }
  const rows = [...byAthlete.entries()].map(([athleteId, awards]) => ({
    athleteId,
    points: round1(awards.reduce((s, a) => s + a.points, 0)),
    events: awards.length,
    best: awards.length ? Math.min(...awards.map((a) => a.position)) : null,
    rank: 0,
    awards: awards.sort((x, y) => (y.date ?? "").localeCompare(x.date ?? "")),
  }));
  rows.sort((a, b) => b.points - a.points || (a.best ?? 999) - (b.best ?? 999));
  rows.forEach((r, i) => {
    r.rank = i > 0 && rows[i - 1].points === r.points ? rows[i - 1].rank : i + 1;
  });
  return rows;
}

/** Puntos de una dupla para la siembra: suma de los puntos individuales de sus jugadores. */
export function teamPoints(ranking: Map<string, number>, athleteIds: (string | null)[]): number {
  return round1(athleteIds.reduce((s, id) => s + (id ? (ranking.get(id) ?? 0) : 0), 0));
}

/** Valida una tabla de puntos escrita por el administrador. */
export function tableIssues(rows: PointRow[]): string[] {
  const issues: string[] = [];
  if (!Array.isArray(rows) || rows.length === 0) return ["La tabla necesita al menos una fila"];
  const sorted = [...rows].sort((a, b) => a.from - b.from);
  sorted.forEach((r, i) => {
    if (!Number.isInteger(r.from) || !Number.isInteger(r.to) || r.from < 1 || r.to < r.from) {
      issues.push(`Fila ${i + 1}: los puestos deben ser enteros y "hasta" no puede ser menor que "desde"`);
    }
    if (!(r.points >= 0)) issues.push(`Fila ${i + 1}: los puntos deben ser 0 o más`);
    if (i > 0 && r.from <= sorted[i - 1].to) issues.push(`Los puestos ${r.from}–${r.to} se superponen con la fila anterior`);
  });
  return issues;
}
