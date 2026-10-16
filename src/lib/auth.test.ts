import { beforeEach, describe, expect, it, vi } from "vitest";

// Límite de intentos de login: con muchos fallos recientes se bloquea sin verificar la contraseña.

process.env.AUTH_SECRET = "x".repeat(40);

const queries: string[] = [];
let recent = { by_email: 0, by_ip: 0 };
let admin: { id: string; password_hash: string } | undefined;
const verifyPassword = vi.fn<(password: string, hash: string) => Promise<boolean>>(async () => false);
const setCookie = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
  cookies: async () => ({ get: () => undefined, set: setCookie, delete: vi.fn() }),
}));
vi.mock("@/lib/password", () => ({ verifyPassword: (p: string, h: string) => verifyPassword(p, h) }));
vi.mock("@/lib/db", () => ({
  sql: (strings: TemplateStringsArray) => {
    const q = strings.join("?").replace(/\s+/g, " ").trim();
    queries.push(q);
    if (q.includes("from login_attempts where attempted_at >")) return Promise.resolve([recent]);
    if (q.startsWith("select id, password_hash from admins")) return Promise.resolve(admin ? [admin] : []);
    return Promise.resolve([]);
  },
}));

const { login, MAX_FAILS_PER_EMAIL, MAX_FAILS_PER_IP } = await import("./auth");

describe("login con límite de intentos", () => {
  beforeEach(() => {
    queries.length = 0;
    recent = { by_email: 0, by_ip: 0 };
    admin = { id: "a1", password_hash: "scrypt$aa$bb" };
    verifyPassword.mockReset().mockResolvedValue(false);
    setCookie.mockReset();
  });

  it("contraseña incorrecta: registra el intento y no crea sesión", async () => {
    expect(await login("Admin@Ejemplo.com ", "mala")).toBe("invalid");
    expect(queries.some((q) => q.startsWith("insert into login_attempts"))).toBe(true);
    expect(setCookie).not.toHaveBeenCalled();
  });

  it(`con ${MAX_FAILS_PER_EMAIL} fallos recientes del correo: bloquea sin verificar la contraseña`, async () => {
    recent = { by_email: MAX_FAILS_PER_EMAIL, by_ip: 0 };
    verifyPassword.mockResolvedValue(true);
    expect(await login("admin@ejemplo.com", "correcta")).toBe("locked");
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(setCookie).not.toHaveBeenCalled();
  });

  it(`con ${MAX_FAILS_PER_IP} fallos recientes desde la misma IP: bloquea`, async () => {
    recent = { by_email: 0, by_ip: MAX_FAILS_PER_IP };
    expect(await login("otro@ejemplo.com", "x")).toBe("locked");
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("debajo del límite y contraseña correcta: entra y limpia los fallos del correo", async () => {
    recent = { by_email: MAX_FAILS_PER_EMAIL - 1, by_ip: 0 };
    verifyPassword.mockResolvedValue(true);
    expect(await login("admin@ejemplo.com", "correcta")).toBe("ok");
    expect(setCookie).toHaveBeenCalledOnce();
    expect(queries.some((q) => q.startsWith("delete from login_attempts where email"))).toBe(true);
  });

  it("correo inexistente: igual verifica (no revela si existe) y registra el intento", async () => {
    admin = undefined;
    expect(await login("nadie@ejemplo.com", "x")).toBe("invalid");
    expect(verifyPassword).toHaveBeenCalledOnce();
    expect(queries.some((q) => q.startsWith("insert into login_attempts"))).toBe(true);
  });
});
