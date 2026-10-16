import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Comprueba que NINGUNA acción de administrador se ejecute sin una sesión válida de un admin
// existente. Recorre todas las exportaciones de actions.ts: una acción nueva queda cubierta sola.

process.env.AUTH_SECRET = "x".repeat(40);

const cookieJar = new Map<string, string>();
const sqlCalls: string[] = [];

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db", () => {
  // Registra cada consulta; la búsqueda del admin devuelve vacío (admin inexistente).
  const sql = Object.assign(
    (strings: TemplateStringsArray) => {
      sqlCalls.push(strings.join("?").replace(/\s+/g, " ").trim());
      return Promise.resolve([]);
    },
    {
      json: (v: unknown) => v,
      begin: async (fn: (tx: unknown) => Promise<unknown>) => fn(sql),
    },
  );
  return { sql };
});

const ID = "11111111-1111-4111-8111-111111111111";
const form = () => {
  const f = new FormData();
  for (const k of ["name", "city", "gender", "player1", "player2"]) f.set(k, "X");
  f.set("gender", "F");
  return f;
};
// Argumentos plausibles para cualquier acción (ids válidos, formulario lleno).
const argsFor = (arity: number) =>
  Array.from({ length: Math.max(arity, 3) }, (_, i) => (i === 0 ? ID : i === 1 ? form() : ID));

async function allActions() {
  const mod = await import("./actions");
  return Object.entries(mod).filter(([, v]) => typeof v === "function") as [string, (...a: unknown[]) => Promise<unknown>][];
}

const sessionToken = (secret: string, sub: string) =>
  new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));

describe("acciones de administrador", () => {
  beforeEach(() => {
    cookieJar.clear();
    sqlCalls.length = 0;
  });

  it("hay acciones que probar", async () => {
    expect((await allActions()).length).toBeGreaterThanOrEqual(10);
  });

  it("sin sesión: todas fallan y no tocan la base de datos", async () => {
    for (const [name, fn] of await allActions()) {
      await expect(fn(...argsFor(fn.length)), name).rejects.toThrow("Solo los administradores");
    }
    expect(sqlCalls).toEqual([]);
  });

  it("con una cookie firmada con otra clave: todas fallan", async () => {
    cookieJar.set("torneos_session", await sessionToken("y".repeat(40), ID));
    for (const [name, fn] of await allActions()) {
      await expect(fn(...argsFor(fn.length)), name).rejects.toThrow("Solo los administradores");
    }
    expect(sqlCalls).toEqual([]);
  });

  it("con sesión válida de un admin que ya no existe: todas fallan y solo se consulta la tabla admins", async () => {
    cookieJar.set("torneos_session", await sessionToken(process.env.AUTH_SECRET!, ID));
    for (const [name, fn] of await allActions()) {
      await expect(fn(...argsFor(fn.length)), name).rejects.toThrow("Solo los administradores");
    }
    expect(sqlCalls.length).toBeGreaterThan(0);
    expect(sqlCalls.every((q) => q.startsWith("select id, email from admins"))).toBe(true);
  });
});
