import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ sql: Object.assign(vi.fn(), { json: vi.fn() }) }));
const { feeOf, formatSoles, paymentStatus, voucherType } = await import("./registrations");

const reg = (fee: string | null, o: { paid_at?: string | null; payment_uploaded_at?: string | null } = {}) => ({
  paid_at: null,
  payment_uploaded_at: null,
  ...o,
  category: { registration_fee: fee },
});

describe("pagos de inscripción", () => {
  it("monto: vacío o 0 = sin costo", () => {
    expect(feeOf({ registration_fee: null })).toBeNull();
    expect(feeOf({ registration_fee: "0.00" })).toBeNull();
    expect(feeOf({ registration_fee: "50.00" })).toBe(50);
    expect(formatSoles(50)).toBe("S/ 50");
    expect(formatSoles(52.5)).toBe("S/ 52.50");
  });

  it("estado del pago", () => {
    expect(paymentStatus(reg(null))).toBe("free");
    expect(paymentStatus(reg("50"))).toBe("pending");
    expect(paymentStatus(reg("50", { payment_uploaded_at: "2026-11-21" }))).toBe("submitted");
    expect(paymentStatus(reg("50", { payment_uploaded_at: "2026-11-21", paid_at: "2026-11-21" }))).toBe("paid");
    // Pagado en efectivo, sin comprobante.
    expect(paymentStatus(reg("50", { paid_at: "2026-11-21" }))).toBe("paid");
  });

  it("reconoce el comprobante por su contenido, no por la extensión", () => {
    expect(voucherType(Buffer.from("%PDF-1.7 ..."))).toBe("application/pdf");
    expect(voucherType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe("image/jpeg");
    expect(voucherType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(voucherType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]))).toBe("image/webp");
    expect(voucherType(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(voucherType(Buffer.from("GIF89a"))).toBeNull();
  });
});
