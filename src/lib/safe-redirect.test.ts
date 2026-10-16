import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-redirect";

describe("safeNext (destino después del login)", () => {
  it("acepta rutas del panel", () => {
    expect(safeNext("/admin")).toBe("/admin");
    expect(safeNext("/admin/torneos/123")).toBe("/admin/torneos/123");
    expect(safeNext("/admin?x=1")).toBe("/admin?x=1");
  });
  it.each([
    "/\\evil.example",
    "//evil.example",
    "https://evil.example",
    "/admin/\\evil.example",
    "/admin//evil.example",
    "/adminevil",
    "/torneos/1",
    "javascript:alert(1)",
    " /admin",
    "",
  ])("rechaza %j", (bad) => {
    expect(safeNext(bad)).toBe("/admin");
  });
  it("rechaza valores que no son texto", () => {
    expect(safeNext(null)).toBe("/admin");
  });
});
