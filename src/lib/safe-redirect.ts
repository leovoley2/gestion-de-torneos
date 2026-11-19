/**
 * Destino seguro después del login: solo rutas internas bajo `prefix` (/admin o /cuenta).
 * Rechaza "//otro.com", "/\otro.com" (los navegadores lo leen como "//"), esquemas y espacios.
 */
export function safeNext(next: unknown, fallback = "/admin", prefix: "/admin" | "/cuenta" = "/admin"): string {
  if (typeof next !== "string") return fallback;
  if (!new RegExp(`^${prefix}(?:[/?#]|$)`).test(next)) return fallback;
  if (/[\\\s]/.test(next) || next.includes("//")) return fallback;
  return next;
}
