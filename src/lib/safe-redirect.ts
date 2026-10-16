/**
 * Destino seguro después del login: solo rutas internas del panel.
 * Rechaza "//otro.com", "/\otro.com" (los navegadores lo leen como "//"), esquemas y espacios.
 */
export function safeNext(next: unknown, fallback = "/admin"): string {
  if (typeof next !== "string") return fallback;
  if (!/^\/admin(?:[/?#]|$)/.test(next)) return fallback;
  if (/[\\\s]/.test(next) || next.includes("//")) return fallback;
  return next;
}
