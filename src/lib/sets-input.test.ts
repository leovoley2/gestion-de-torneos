import { describe, expect, it } from "vitest";
import { parseSetInputs } from "./sets-input";

describe("parseSetInputs (casillas de sets)", () => {
  it("lee sets completos e ignora los vacíos del final", () => {
    expect(parseSetInputs([{ a: "21", b: "18" }, { a: "21", b: "19" }, { a: "", b: "" }])).toEqual({
      sets: [{ a: 21, b: 18 }, { a: 21, b: 19 }],
    });
  });
  it("una casilla vacía NO es 0", () => {
    expect(parseSetInputs([{ a: "21", b: "" }, { a: "21", b: "15" }])).toEqual({
      error: "Set 1: completa los puntajes de las dos duplas",
    });
  });
  it("acepta 0 escrito explícitamente", () => {
    expect(parseSetInputs([{ a: "21", b: "0" }])).toEqual({ sets: [{ a: 21, b: 0 }] });
  });
  it("rechaza sets vacíos en medio", () => {
    expect("error" in parseSetInputs([{ a: "", b: "" }, { a: "21", b: "15" }])).toBe(true);
  });
  it("rechaza todo vacío y texto no numérico", () => {
    expect("error" in parseSetInputs([{ a: "", b: "" }])).toBe(true);
    expect("error" in parseSetInputs([{ a: "2x", b: "15" }])).toBe(true);
  });
});
