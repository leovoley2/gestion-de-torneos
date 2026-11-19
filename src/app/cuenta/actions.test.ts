import { SignJWT } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Ninguna acción de la cuenta de atleta se ejecuta sin una sesión válida de un atleta existente.
// Recorre todas las exportaciones de cuenta/actions.ts: una acción nueva queda cubierta sola.

process.env.AUTH_SECRET = "x".repeat(40);

const cookieJar = new Map<string, string>();
const sqlCalls: string[] = [];

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@vercel/blob", () => ({ put: vi.fn(), get: vi.fn(), del: vi.fn() }));
vi.mock("@/lib/db", () => {
  const sql = Object.assign(
    (strings: TemplateStringsArray) => {
      sqlCalls.push(strings.join("?").replace(/\s+/g, " ").trim());
      return Promise.resolve([]); // el atleta de la sesión "no existe"
    },
    { json: (v: unknown) => v, begin: async (fn: (tx: unknown) => Promise<unknown>) => fn(sql) },
  );
  return { sql };
});

const mod = await import("./actions");
const actions = Object.entries(mod).filter(([, v]) => typeof v === "function") as [string, (...a: unknown[]) => Promise<unknown>][];

const ID = "11111111-1111-4111-8111-111111111111";
const form = () => {
  const f = new FormData();
  for (const k of ["first_name", "last_name", "partner", "category_id"]) f.set(k, ID);
  f.set("document_type", "DNI");
  return f;
};
const argsFor = (arity: number) => Array.from({ length: Math.max(arity, 2) }, (_, i) => (i === 0 ? null : form())).map((v, i) => (i === 0 && arity !== 2 ? ID : v));
const token = (sub: string, claims: Record<string, unknown>, secret = process.env.AUTH_SECRET!) =>
  new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setSubject(sub).setExpirationTime("1h").sign(new TextEncoder().encode(secret));

describe("acciones de la cuenta de atleta", () => {
  beforeEach(() => {
    cookieJar.clear();
    sqlCalls.length = 0;
  });

  it("hay acciones que probar", () => {
    expect(actions.length).toBeGreaterThanOrEqual(6);
  });

  it("sin sesión: todas fallan y no tocan la base de datos", async () => {
    for (const [name, fn] of actions) {
      await expect(fn(...argsFor(fn.length)), name).rejects.toThrow("Inicia sesión");
    }
    expect(sqlCalls).toEqual([]);
  });

  it("una sesión de ADMIN en la cookie de atleta no sirve", async () => {
    cookieJar.set("atleta_session", await token(ID, { typ: "admin" }));
    for (const [name, fn] of actions) {
      await expect(fn(...argsFor(fn.length)), name).rejects.toThrow("Inicia sesión");
    }
    expect(sqlCalls).toEqual([]);
  });

  it("cookie firmada con otra clave: todas fallan", async () => {
    cookieJar.set("atleta_session", await token(ID, { typ: "athlete" }, "y".repeat(40)));
    for (const [name, fn] of actions) {
      await expect(fn(...argsFor(fn.length)), name).rejects.toThrow("Inicia sesión");
    }
    expect(sqlCalls).toEqual([]);
  });

  it("sesión válida de un atleta borrado: todas fallan y solo se busca al atleta", async () => {
    cookieJar.set("atleta_session", await token(ID, { typ: "athlete" }));
    for (const [name, fn] of actions) {
      await expect(fn(...argsFor(fn.length)), name).rejects.toThrow("Inicia sesión");
    }
    expect(sqlCalls.length).toBeGreaterThan(0);
    expect(sqlCalls.every((q) => q.startsWith("select * from athletes where id"))).toBe(true);
  });
});
