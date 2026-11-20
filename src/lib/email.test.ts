import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ sql: vi.fn(() => Promise.resolve([])) }));
const { describeResendError, emailStatus, sendEmail } = await import("./email");

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
  vi.unstubAllGlobals();
});

describe("correos", () => {
  it("explica los errores de Resend", () => {
    expect(describeResendError(403, '{"message":"The example.pe domain is not verified"}')).toMatch(/dominio.*no está verificado/);
    expect(describeResendError(401, '{"message":"API key is invalid"}')).toMatch(/RESEND_API_KEY/);
    expect(describeResendError(422, '{"message":"Invalid from field"}')).toMatch(/EMAIL_FROM/);
    expect(describeResendError(500, "boom")).toBe("Resend respondió 500: boom");
  });

  it("detecta lo que falta en la configuración", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.APP_URL;
    process.env.EMAIL_FROM = "onboarding@resend.dev";
    const s = emailStatus();
    expect(s.enabled).toBe(false);
    expect(s.problems.join(" ")).toMatch(/RESEND_API_KEY/);
    expect(s.problems.join(" ")).toMatch(/resend\.dev/);
    expect(s.problems.join(" ")).toMatch(/APP_URL/);
  });

  it("devuelve el error de Resend sin lanzar", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Torneos <t@example.pe>";
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"message":"API key is invalid"}', { status: 401 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await sendEmail({ to: "a@b.pe", subject: "x", html: "<p>x</p>" });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/RESEND_API_KEY/) });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    expect(await sendEmail({ to: "a@b.pe", subject: "x", html: "" })).toEqual({ ok: true, sent: true });
    expect(await sendEmail({ to: null, subject: "x", html: "" })).toEqual({ ok: true, sent: false });
  });
});
