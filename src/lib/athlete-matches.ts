// Partidos de una dupla dentro de una categoría (lógica pura, sin base de datos).
import type { ResolvedMatch, TournamentState } from "@/lib/engine";

export interface TeamMatch {
  key: string;
  number: number;
  label: string;
  opponent: string | null; // id de la dupla rival (null si todavía no se sabe)
  status: ResolvedMatch["status"];
  scheduledAt: string | null;
  court: string | null;
  /** Solo si se jugó: sets desde el punto de vista de la dupla ("21-18, 19-21, 15-12"). */
  score: string | null;
  won: boolean | null;
  walkover: boolean;
}

export interface TeamRecord {
  upcoming: TeamMatch[];
  played: TeamMatch[];
  wins: number;
  losses: number;
}

/**
 * Partidos de `teamId`: los que faltan jugar (por hora; sin hora al final, por número) y los ya
 * jugados (el más reciente primero). Solo cuenta los partidos en los que la dupla ya está asignada:
 * un "Ganador P12" todavía no es un partido suyo.
 */
export function teamMatches(
  state: TournamentState | null,
  teamId: string,
  schedule: Record<string, { court: string | null; scheduled_at: string | null }>,
): TeamRecord {
  const mine = (state?.matches ?? []).filter(
    (m) => m.status !== "cancelled" && (m.teamA === teamId || m.teamB === teamId),
  );
  const toMatch = (m: ResolvedMatch): TeamMatch => {
    const isA = m.teamA === teamId;
    const finished = m.status === "finished";
    const sets = m.result?.sets ?? [];
    return {
      key: m.key,
      number: m.number,
      label: m.label,
      opponent: (isA ? m.teamB : m.teamA) ?? null,
      status: m.status,
      scheduledAt: schedule[m.key]?.scheduled_at ?? null,
      court: schedule[m.key]?.court ?? null,
      score:
        finished && sets.length && !m.result?.walkoverWinner
          ? sets.map((s) => (isA ? `${s.a}-${s.b}` : `${s.b}-${s.a}`)).join(", ")
          : null,
      won: finished ? m.winner === teamId : null,
      walkover: Boolean(m.result?.walkoverWinner),
    };
  };
  const byTime = (a: TeamMatch, b: TeamMatch) => {
    if (a.scheduledAt && b.scheduledAt && a.scheduledAt !== b.scheduledAt) return a.scheduledAt < b.scheduledAt ? -1 : 1;
    if (Boolean(a.scheduledAt) !== Boolean(b.scheduledAt)) return a.scheduledAt ? -1 : 1;
    return a.number - b.number;
  };
  const upcoming = mine.filter((m) => m.status !== "finished").map(toMatch).sort(byTime);
  const played = mine.filter((m) => m.status === "finished").map(toMatch).sort((a, b) => byTime(b, a));
  return {
    upcoming,
    played,
    wins: played.filter((m) => m.won).length,
    losses: played.filter((m) => m.won === false).length,
  };
}
