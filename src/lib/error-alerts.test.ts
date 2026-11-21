import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ sql: vi.fn() }));
const { errorSignature, isExpectedError } = await import("./error-alerts");

describe("aviso de errores", () => {
  it("no avisa de errores esperados (permisos, sesión, redirecciones)", () => {
    expect(isExpectedError("Inicia sesión con tu cuenta de atleta")).toBe(true);
    expect(isExpectedError("No tienes permiso para hacer esto")).toBe(true);
    expect(isExpectedError("NEXT_REDIRECT;replace;/cuenta")).toBe(true);
    expect(isExpectedError("connect ECONNREFUSED")).toBe(false);
    expect(isExpectedError('relation "teams" does not exist')).toBe(false);
  });

  it("agrupa la misma falla aunque cambien ids y números", () => {
    const a = errorSignature("Categoría 1b2c3d4e-0000-4000-8000-000000000001 falló en el partido 12", "/torneos/[id]");
    const b = errorSignature("Categoría 9f9f9f9f-0000-4000-8000-000000000002 falló en el partido 7", "/torneos/[id]");
    expect(a).toBe(b);
    expect(errorSignature("otro error", "/torneos/[id]")).not.toBe(a);
    expect(errorSignature("Categoría x falló", "/ranking")).not.toBe(errorSignature("Categoría x falló", "/torneos/[id]"));
  });
});
