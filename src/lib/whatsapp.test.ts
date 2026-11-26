import { describe, expect, it } from "vitest";
import { inviteMessage, whatsappUrl } from "./whatsapp";

describe("WhatsApp", () => {
  it("mensaje de invitación con el enlace", () => {
    const m = inviteMessage({ partnerFirstName: "Lucía", tournament: "3ra Parada", category: "Adulto", url: "https://x.pe/cuenta/inscripciones/1" });
    expect(m).toContain("¡Hola Lucía!");
    expect(m).toContain("3ra Parada · Adulto");
    expect(m).toContain("https://x.pe/cuenta/inscripciones/1");
    expect(inviteMessage({ partnerFirstName: "", tournament: "T", category: "C", url: "u" })).toMatch(/^¡Hola! /);
  });
  it("codifica el texto en el enlace", () => {
    const u = whatsappUrl("Hola & chau\n?");
    expect(u.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(u.split("text=")[1])).toBe("Hola & chau\n?");
  });
});
