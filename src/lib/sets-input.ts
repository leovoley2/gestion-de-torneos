import type { SetScore } from "@/lib/engine";

/**
 * Convierte lo escrito en las casillas de sets a puntajes. Un set debe tener los dos lados:
 * una casilla vacía no se toma como 0. Tampoco se permiten sets vacíos en medio.
 */
export function parseSetInputs(rows: { a: string; b: string }[]): { sets: SetScore[] } | { error: string } {
  const sets: SetScore[] = [];
  let sawEmpty = false;
  for (const [i, row] of rows.entries()) {
    const a = row.a.trim();
    const b = row.b.trim();
    if (a === "" && b === "") {
      sawEmpty = true;
      continue;
    }
    if (a === "" || b === "") return { error: `Set ${i + 1}: completa los puntajes de las dos duplas` };
    if (sawEmpty) return { error: `Set ${i + 1}: hay un set vacío antes; carga los sets en orden` };
    if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) return { error: `Set ${i + 1}: usa solo números` };
    sets.push({ a: Number(a), b: Number(b) });
  }
  if (sets.length === 0) return { error: "Escribe el puntaje de al menos un set" };
  return { sets };
}
