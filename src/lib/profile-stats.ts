// Números del perfil público de un atleta (lógica pura, sin base de datos).
import type { TeamMatch } from "@/lib/athlete-matches";

export interface ProfileParticipation {
  teamId: string;
  partner: { id: string | null; name: string };
  tournament: { start_date: string | null };
  position: number | null;
  record: { played: TeamMatch[]; wins: number; losses: number };
}

export interface ProfileStats {
  tournaments: number;
  wins: number;
  losses: number;
  winRate: number | null; // 0 a 1; null si no jugó partidos
  best: number | null;
  medals: { gold: number; silver: number; bronze: number };
  /** Últimos partidos jugados, el más reciente primero (true = ganado). */
  form: boolean[];
  partners: { id: string | null; name: string; count: number }[];
}

/** Iniciales para el avatar: "Ana Torres" → "AT", "Lía" → "L". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function profileStats(list: ProfileParticipation[], formSize = 5): ProfileStats {
  const wins = list.reduce((n, p) => n + p.record.wins, 0);
  const losses = list.reduce((n, p) => n + p.record.losses, 0);
  const positions = list.map((p) => p.position).filter((x): x is number => x !== null);

  // Racha: partidos jugados ordenados por hora (los sin hora, por fecha del torneo y número).
  const played = list.flatMap((p) =>
    p.record.played.map((m) => ({ won: m.won === true, at: m.scheduledAt ?? `${p.tournament.start_date ?? ""}T00:00:${String(m.number).padStart(2, "0")}` })),
  );
  played.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  const byPartner = new Map<string, { id: string | null; name: string; count: number }>();
  for (const p of list) {
    const key = p.partner.id ?? `nombre:${p.partner.name.toLowerCase()}`;
    const cur = byPartner.get(key) ?? { id: p.partner.id, name: p.partner.name, count: 0 };
    cur.count += 1;
    byPartner.set(key, cur);
  }

  return {
    tournaments: list.length,
    wins,
    losses,
    winRate: wins + losses > 0 ? wins / (wins + losses) : null,
    best: positions.length ? Math.min(...positions) : null,
    medals: {
      gold: positions.filter((x) => x === 1).length,
      silver: positions.filter((x) => x === 2).length,
      bronze: positions.filter((x) => x === 3).length,
    },
    form: played.slice(0, formSize).map((m) => m.won),
    partners: [...byPartner.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

/** Agrupa por año (del más reciente al más antiguo); "Sin fecha" al final. */
export function byYear<T extends { tournament: { start_date: string | null } }>(list: T[]): { year: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const p of list) {
    const y = p.tournament.start_date?.slice(0, 4) ?? "Sin fecha";
    groups.set(y, [...(groups.get(y) ?? []), p]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === "Sin fecha" ? 1 : b === "Sin fecha" ? -1 : b.localeCompare(a)))
    .map(([year, items]) => ({ year, items }));
}
