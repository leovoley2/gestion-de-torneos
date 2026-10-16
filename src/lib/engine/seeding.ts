import type { SeedingMethod } from "./types";

export const groupName = (index: number) => String.fromCharCode(65 + index);

/** Generador pseudoaleatorio con semilla, para que un sorteo sea reproducible. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Reparte elementos ordenados por siembra en `groupCount` grupos.
 * - serpentine: A B C D D C B A A B…  (equilibra la fuerza de los grupos)
 * - sequential: A B C D A B C D…
 * - random: sorteo por bombos (cada "fila" de la serpentina se sortea entre grupos)
 * - manual: `manualGroups[i]` indica el grupo del elemento i
 */
export function distributeIntoGroups<T>(
  items: T[],
  groupCount: number,
  method: SeedingMethod,
  options: { manualGroups?: number[]; random?: () => number } = {},
): T[][] {
  const groups: T[][] = Array.from({ length: groupCount }, () => []);
  if (method === "manual") {
    items.forEach((item, i) => {
      const g = options.manualGroups?.[i] ?? i % groupCount;
      groups[g].push(item);
    });
    return groups;
  }
  const random = options.random ?? Math.random;
  for (let start = 0; start < items.length; start += groupCount) {
    const pot = items.slice(start, start + groupCount);
    const row = start / groupCount;
    let order = Array.from({ length: groupCount }, (_, i) => i);
    if (method === "serpentine" && row % 2 === 1) order.reverse();
    if (method === "random") order = shuffle(order, random);
    pot.forEach((item, i) => groups[order[i]].push(item));
  }
  return groups;
}

/**
 * Orden estándar de siembra en una llave de `size` (potencia de 2):
 * size 8 → [1, 8, 4, 5, 2, 7, 3, 6]. Así 1 y 2 solo se cruzan en la final.
 */
export function bracketSeedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((s) => [s, n + 1 - s]);
  }
  return order;
}

export const nextPowerOfTwo = (n: number) => {
  let p = 1;
  while (p < n) p *= 2;
  return p;
};
