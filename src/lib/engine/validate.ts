import { generateFormat } from "./generate";
import { simulateTournament } from "./simulate";
import type { FormatDefinition, GeneratedFormat, Source, TeamRef } from "./types";

const sourceKey = (s: Source) => JSON.stringify(s);

/**
 * Revisa que un formato se pueda jugar completo con `teamCount` duplas.
 * Devuelve mensajes en español (vacío = formato válido). Además de chequeos puntuales con
 * mensajes claros, simula el torneo entero: si algún partido nunca puede definirse, se rechaza.
 */
export function validateFormat(format: FormatDefinition, teamCount: number): string[] {
  const errors: string[] = [];
  if (!format?.stages?.length) return ["El formato no tiene fases"];

  let gen: GeneratedFormat;
  try {
    gen = generateFormat(format);
  } catch (e) {
    return [`No se pudo generar: ${(e as Error).message}`];
  }
  if (gen.matches.length === 0) return ["El formato no genera partidos"];

  const groupSize = new Map(gen.groups.map((g) => [g.key, g.slots.length]));
  const groupName = new Map(gen.groups.map((g) => [g.key, g.name]));
  const stageName = new Map(format.stages.map((s) => [s.key, s.name]));

  const list = (names: string[]) =>
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;

  // Grupos con menos de 2 duplas no tienen partidos y no pueden ordenar a nadie (un mensaje por fase).
  for (const stage of format.stages) {
    const small = gen.groups.filter((g) => g.stageKey === stage.key && g.slots.length < 2).map((g) => g.name);
    if (small.length > 0) {
      errors.push(
        `${small.length === 1 ? `El grupo ${small[0]} queda` : `Los grupos ${list(small)} quedan`} con menos de 2 duplas en "${stageName.get(stage.key)}". Usa menos grupos.`,
      );
    }
  }

  // Referencias imposibles: sembrados que no existen, puestos que el grupo no tiene.
  const allSources: Source[] = [
    ...gen.matches.flatMap((m) => [m.a, m.b].filter((s): s is Source => s !== null)),
    ...gen.groups.flatMap((g) => g.slots),
  ];
  const missingSeeds = new Set<number>();
  const missingPositions = new Map<number, Set<string>>(); // puesto → grupos que no lo tienen
  const reported = new Set<string>();
  const once = (msg: string) => {
    if (!reported.has(msg)) {
      reported.add(msg);
      errors.push(msg);
    }
  };
  for (const s of allSources) {
    if (s.type === "seed" && (s.seed < 1 || s.seed > teamCount)) missingSeeds.add(s.seed);
    if (s.type === "group_position") {
      const size = groupSize.get(s.groupKey);
      if (size === undefined) once(`Se pide un puesto de un grupo que no existe (${s.groupKey}).`);
      else if (s.position > size) {
        if (!missingPositions.has(s.position)) missingPositions.set(s.position, new Set());
        missingPositions.get(s.position)!.add(groupName.get(s.groupKey)!);
      }
    }
    if (s.type === "ranking_position") {
      const groups = gen.groups.filter((g) => g.stageKey === s.stageKey && g.slots.length >= s.position);
      if (s.rank > groups.length) {
        once(`Se pide el ${s.rank}º mejor ${s.position}º, pero solo ${groups.length} grupos tienen ${s.position}º puesto.`);
      }
    }
  }
  if (missingSeeds.size > 0) {
    const seeds = [...missingSeeds].sort((a, b) => a - b);
    errors.push(
      `Se ${seeds.length === 1 ? "pide el sembrado" : "piden los sembrados"} ${list(seeds.map(String))}, pero hay ${teamCount} duplas inscritas.`,
    );
  }
  for (const [position, groups] of [...missingPositions].sort((a, b) => a[0] - b[0])) {
    const names = [...groups].sort();
    errors.push(
      `Se pide el ${position}º puesto ${names.length === 1 ? `del grupo ${names[0]}` : `de los grupos ${list(names)}`}, pero no tiene${names.length === 1 ? "" : "n"} tantas duplas. Reduce los clasificados por grupo.`,
    );
  }

  // Una misma dupla no puede entrar dos veces a una fase de eliminación.
  for (const stage of format.stages) {
    if (stage.type !== "single_elimination" && stage.type !== "double_elimination") continue;
    const seen = new Set<string>();
    for (const s of stage.entrants) {
      const k = sourceKey(s);
      if (seen.has(k)) once(`La fase "${stage.name}" recibe dos veces al mismo clasificado.`);
      seen.add(k);
    }
    if (stage.entrants.length < 2) once(`La fase "${stage.name}" necesita al menos 2 duplas.`);
  }

  if (errors.length > 0) return errors;

  // Prueba final: jugar el torneo completo con resultados simulados.
  const teams: TeamRef[] = Array.from({ length: teamCount }, (_, i) => ({ id: `T${i + 1}`, name: `T${i + 1}`, seed: i + 1 }));
  const { state } = simulateTournament(format, gen, teams);
  const stuck = state.matches.filter((m) => m.status === "undefined" || m.status === "ready");
  if (stuck.length > 0) {
    errors.push(
      `Hay partidos que nunca podrán definirse: ${stuck
        .slice(0, 8)
        .map((m) => `P${m.number}`)
        .join(", ")}${stuck.length > 8 ? "…" : ""}. Revisa grupos y clasificados.`,
    );
  }
  if (state.matches.some((m) => m.teamA && m.teamA === m.teamB)) {
    errors.push("Algún partido enfrenta a una dupla contra sí misma. Revisa los cruces.");
  }
  return errors;
}
