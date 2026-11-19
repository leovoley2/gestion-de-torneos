import type { FormatDefinition, GeneratedFormat } from "./types";
import type { TournamentState } from "./resolve";

export interface FinalPosition {
  teamId: string;
  position: number; // los empatados comparten posición (p. ej. 5º para los 4 perdedores de cuartos)
}

/**
 * Posición final de cada dupla de una categoría terminada (o en curso: lo que se sepa hasta ahora).
 * - Los primeros puestos salen de la última fase (final, 3er puesto, final de perdedores…).
 * - El resto se ordena por cuándo quedó eliminado: más tarde = mejor; los eliminados en la misma
 *   ronda empatan. Los eliminados en grupos se ordenan por su puesto en el grupo.
 */
export function finalStandings(
  format: FormatDefinition,
  gen: GeneratedFormat,
  state: TournamentState,
  teamIds: string[],
): FinalPosition[] {
  const stageIndex = new Map(format.stages.map((s, i) => [s.key, i]));
  const lastStage = format.stages[format.stages.length - 1];
  const result: FinalPosition[] = [];
  const placed = new Set<string>();

  // 1) Podio y puestos definidos por partidos de la última fase.
  const top = (state.placements[lastStage.key] ?? []).filter((id): id is string => Boolean(id));
  if (lastStage.type === "round_robin" || lastStage.type === "pool_fivb") {
    // Liga o grupos al final: el puesto en el grupo (los de igual puesto en distintos grupos empatan).
    const groups = gen.groups.filter((g) => g.stageKey === lastStage.key);
    for (const g of groups) {
      (state.placements[g.key] ?? []).forEach((id, i) => {
        if (id && !placed.has(id)) {
          placed.add(id);
          result.push({ teamId: id, position: i * groups.length + 1 });
        }
      });
    }
  } else {
    top.forEach((id, i) => {
      if (!placed.has(id)) {
        placed.add(id);
        result.push({ teamId: id, position: i + 1 });
      }
    });
  }

  // 2) Clave de eliminación de cada dupla restante: [fase, tipo (0 grupo / 1 llave), ronda o -puesto].
  const keyOf = (teamId: string): number[] => {
    const played = state.matches
      .filter((m) => m.status === "finished" && (m.teamA === teamId || m.teamB === teamId))
      .sort((a, b) => a.number - b.number);
    const last = played[played.length - 1];
    if (!last) return [-1];
    const stage = stageIndex.get(last.stageKey) ?? 0;
    if (last.groupKey) {
      const places = state.placements[last.groupKey] ?? [];
      const rows = state.standings[last.groupKey] ?? [];
      const pos = places.includes(teamId) ? places.indexOf(teamId) + 1 : (rows.find((r) => r.teamId === teamId)?.position ?? 99);
      return [stage, 0, -pos];
    }
    return [stage, 1, last.round];
  };
  const compare = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = (a[i] ?? 0) - (b[i] ?? 0);
      if (d !== 0) return d;
    }
    return 0;
  };

  const rest = teamIds.filter((id) => !placed.has(id)).map((id) => ({ id, key: keyOf(id) }));
  rest.sort((x, y) => compare(y.key, x.key));
  const base = placed.size;
  for (const r of rest) {
    const better = rest.filter((o) => compare(o.key, r.key) > 0).length;
    result.push({ teamId: r.id, position: base + better + 1 });
  }
  return result.sort((a, b) => a.position - b.position);
}

/** Cuántas duplas comparten cada posición. */
export function tieSizes(positions: FinalPosition[]): Map<number, number> {
  const sizes = new Map<number, number>();
  for (const p of positions) sizes.set(p.position, (sizes.get(p.position) ?? 0) + 1);
  return sizes;
}
