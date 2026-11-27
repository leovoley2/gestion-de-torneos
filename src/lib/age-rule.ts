// Regla de edad de una categoría, explicada en palabras. "Nacidos desde" es el año del mayor permitido
// (de ahí en adelante); "nacidos hasta" deja fuera a los más pequeños. Sin años = edad libre.
// Lógica pura: se usa en el formulario del admin (cliente) y en las vistas del atleta.

export interface AgeRule {
  min_birth_year: number | null;
  max_birth_year: number | null;
}

/** Año de la temporada: el del inicio del torneo o, si no hay, el actual. */
export function seasonYear(startDate?: string | null, now = new Date()): number {
  const y = startDate ? Number(startDate.slice(0, 4)) : NaN;
  return Number.isInteger(y) && y > 1900 ? y : now.getFullYear();
}

/** Etiqueta corta para el atleta: "Edad libre", "Nacidos 2006–2014", "Nacidos desde 2006"… */
export function ageRuleShort({ min_birth_year: min, max_birth_year: max }: AgeRule): string {
  if (min && max) return `Nacidos ${min}–${max}`;
  if (min) return `Nacidos desde ${min}`;
  if (max) return `Nacidos hasta ${max}`;
  return "Edad libre";
}

/** Frase completa con las edades que cumplen ese año. */
export function ageRuleSentence({ min_birth_year: min, max_birth_year: max }: AgeRule, year: number): string {
  if (min && max) {
    return min === max
      ? `Solo nacidos en ${min} (${year - min} años en ${year}).`
      : `Pueden inscribirse nacidos entre ${min} y ${max} (de ${year - max} a ${year - min} años en ${year}).`;
  }
  if (min) return `Pueden inscribirse nacidos en ${min} o después (hasta ${year - min} años en ${year}).`;
  if (max) return `Pueden inscribirse nacidos en ${max} o antes (desde ${year - max} años en ${year}).`;
  return "Cualquier edad puede inscribirse.";
}

/** "Nacidos desde" que corresponde a una categoría U-N (Sub-N): menores de N años ese año. */
export const underYear = (n: number, year: number) => year - (n - 1);
