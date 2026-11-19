import { SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";

// Un miembro con rol limitado solo puede usar las acciones de su rol. Se simula una sesión válida
// de "Mesa de resultados" y se llama a TODAS las acciones del panel.

process.env.AUTH_SECRET = "x".repeat(40);
const ID = "11111111-1111-4111-8111-111111111111";
const T1 = "22222222-2222-4222-8222-222222222222";
let grants: { role: string; tournament_id: string | null }[] = [];
let sessionCookie = "";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) => (name === "torneos_session" && sessionCookie ? { name, value: sessionCookie } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db", () => {
  const sql = Object.assign(
    (strings: TemplateStringsArray) => {
      const q = strings.join("?").replace(/\s+/g, " ").trim();
      if (q.startsWith("select id, email, name from admins")) return Promise.resolve([{ id: ID, email: "mesa@x.pe", name: "Mesa" }]);
      if (q.startsWith("select role, tournament_id from admin_roles")) return Promise.resolve(grants);
      if (q.includes("tournament_id from categories") || q.includes("c.tournament_id from registrations")) {
        return Promise.resolve([{ tournament_id: T1 }]);
      }
      return Promise.resolve([]);
    },
    { json: (v: unknown) => v, begin: async (fn: (tx: unknown) => Promise<unknown>) => fn(sql) },
  );
  return { sql };
});

const modules = [await import("./actions"), await import("./registration-actions"), await import("./team-actions"), await import("./ranking-actions")];
const actions = modules.flatMap((m) => Object.entries(m).filter(([, v]) => typeof v === "function")) as [
  string,
  (...a: unknown[]) => Promise<unknown>,
][];
const form = () => {
  const f = new FormData();
  for (const k of ["name", "city", "player1", "player2"]) f.set(k, "X");
  f.set("gender", "F");
  return f;
};
const args = (arity: number) => Array.from({ length: Math.max(arity, 3) }, (_, i) => (i === 1 ? form() : i === 0 ? T1 : ID));

async function outcome(fn: (...a: unknown[]) => Promise<unknown>) {
  try {
    await fn(...args(fn.length));
    return "permitida";
  } catch (e) {
    return (e as Error).message.includes("No tienes permiso") ? "denegada" : "permitida";
  }
}

describe("roles limitados", () => {
  it("Mesa de resultados: solo resultados y programación", async () => {
    grants = [{ role: "results", tournament_id: null }];
    sessionCookie = await new SignJWT({ typ: "admin" }).setProtectedHeader({ alg: "HS256" }).setSubject(ID).setExpirationTime("1h").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    const allowed: string[] = [];
    for (const [name, fn] of actions) if ((await outcome(fn)) === "permitida") allowed.push(name);
    expect(allowed.sort()).toEqual(["saveResult", "saveSchedule"]);
  });

  it("Organizador de OTRO torneo: no puede tocar este", async () => {
    grants = [{ role: "organizer", tournament_id: "33333333-3333-4333-8333-333333333333" }];
    const allowed: string[] = [];
    for (const [name, fn] of actions) if ((await outcome(fn)) === "permitida") allowed.push(name);
    // Solo quedan las de atender atletas (no son de un torneo).
    expect(allowed.sort()).toEqual(["adminResetLink", "adminVerifyEmail"]);
  });
});
