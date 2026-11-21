import ExcelJS from "exceljs";
import { getAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { GENDER_LABEL, isUuid } from "@/lib/data";
import { sql } from "@/lib/db";
import { ageOn, fullName, isMinor, todayLima, type Athlete } from "@/lib/athletes";
import { PAYMENT_LABEL, feeOf, getCategoryRegistrations, paymentStatus } from "@/lib/registrations";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  pending_partner: "Esperando compañero",
  pending_review: "Por revisar",
  accepted: "Aceptada",
  rejected: "Rechazada",
  declined: "Compañero no aceptó",
  withdrawn: "Retirada",
};
/**
 * Excel no tiene zonas horarias: muestra la fecha tal cual se guarda. Se convierte la hora a la de
 * Lima (armando la fecha con sus componentes locales) para que no aparezca 5 horas adelantada.
 */
const date = (d: Date | string | null) => {
  if (!d) return null;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(d)).map((x) => [x.type, x.value]),
  );
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second));
};

/**
 * Excel del torneo: inscripciones con datos de contacto y pagos, y la lista de duplas de cada
 * categoría. Solo quienes revisan inscripciones de ESE torneo (contiene datos personales).
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = await getAdmin();
  if (!isUuid(id) || !admin || !can(admin.grants, "registrations.review", id)) return new Response("No autorizado", { status: 403 });
  const [t] = await sql<{ name: string; start_date: string | null }[]>`select name, start_date from tournaments where id = ${id}`;
  if (!t) return new Response("No encontrado", { status: 404 });
  const cats = await sql<{ id: string; name: string; gender: "F" | "M" | "X" }[]>`
    select id, name, gender from categories where tournament_id = ${id} order by created_at`;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Torneos Vóley Playa";
  wb.created = new Date();

  // ── Hoja 1: inscripciones y pagos ──
  const ins = wb.addWorksheet("Inscripciones y pagos", { views: [{ state: "frozen", ySplit: 1 }] });
  const player = (prefix: string) => [
    { header: `${prefix} · Nombre`, key: `${prefix}_name`, width: 26 },
    { header: `${prefix} · Documento`, key: `${prefix}_doc`, width: 16 },
    { header: `${prefix} · Nacimiento`, key: `${prefix}_birth`, width: 12, style: { numFmt: "dd/mm/yyyy" } },
    { header: `${prefix} · Edad`, key: `${prefix}_age`, width: 7 },
    { header: `${prefix} · Teléfono`, key: `${prefix}_phone`, width: 14 },
    { header: `${prefix} · Correo`, key: `${prefix}_email`, width: 26 },
    { header: `${prefix} · Club`, key: `${prefix}_club`, width: 18 },
    { header: `${prefix} · Apoderado (menor)`, key: `${prefix}_guardian`, width: 26 },
  ];
  ins.columns = [
    { header: "Categoría", key: "category", width: 18 },
    { header: "Rama", key: "gender", width: 10 },
    { header: "Estado", key: "status", width: 18 },
    { header: "Fecha de inscripción", key: "created", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    ...player("Jugador 1"),
    ...player("Jugador 2"),
    { header: "Monto (S/)", key: "fee", width: 11, style: { numFmt: "#,##0.00" } },
    { header: "Pago", key: "payment", width: 20 },
    { header: "Comprobante enviado", key: "voucher", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    { header: "Pago confirmado", key: "paid", width: 18, style: { numFmt: "dd/mm/yyyy hh:mm" } },
  ];
  const onDate = t.start_date ?? todayLima();
  const fill = (prefix: string, a: Athlete) => ({
    [`${prefix}_name`]: fullName(a) || a.email,
    [`${prefix}_doc`]: a.document_number ? `${a.document_type} ${a.document_number}` : "",
    [`${prefix}_birth`]: a.birthdate ? new Date(`${a.birthdate}T12:00:00Z`) : null,
    [`${prefix}_age`]: a.birthdate ? ageOn(a.birthdate, onDate) : null,
    [`${prefix}_phone`]: a.phone ?? "",
    [`${prefix}_email`]: a.email ?? "",
    [`${prefix}_club`]: a.club ?? "",
    [`${prefix}_guardian`]: isMinor(a, onDate) && a.guardian_name ? `${a.guardian_name} (${a.guardian_relationship ?? ""}) ${a.guardian_phone ?? ""}`.trim() : "",
  });
  for (const c of cats) {
    for (const r of await getCategoryRegistrations(c.id)) {
      const pay = paymentStatus(r);
      ins.addRow({
        category: c.name,
        gender: GENDER_LABEL[c.gender],
        status: STATUS[r.status] ?? r.status,
        created: date(r.created_at),
        ...fill("Jugador 1", r.athlete1),
        ...fill("Jugador 2", r.athlete2),
        fee: feeOf(r.category),
        payment: PAYMENT_LABEL[pay],
        voucher: date(r.payment_uploaded_at),
        paid: date(r.paid_at),
      });
    }
  }

  // ── Hoja 2: duplas por categoría (incluye las cargadas a mano por la organización) ──
  const duplas = wb.addWorksheet("Duplas", { views: [{ state: "frozen", ySplit: 1 }] });
  duplas.columns = [
    { header: "Categoría", key: "category", width: 18 },
    { header: "Siembra", key: "seed", width: 9 },
    { header: "Jugador 1", key: "p1", width: 26 },
    { header: "Jugador 2", key: "p2", width: 26 },
  ];
  const teams = await sql<{ category: string; seed: number; player1: string; player2: string }[]>`
    select c.name as category, tm.seed, tm.player1, tm.player2
    from teams tm join categories c on c.id = tm.category_id
    where c.tournament_id = ${id} order by c.created_at, tm.seed`;
  for (const tm of teams) duplas.addRow({ category: tm.category, seed: tm.seed, p1: tm.player1, p2: tm.player2 });

  for (const ws of [ins, duplas]) {
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF132C54" } };
    head.alignment = { vertical: "middle", wrapText: true };
    head.height = 30;
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  }

  const buf = await wb.xlsx.writeBuffer();
  const safe = t.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").slice(0, 60);
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="inscritos-${safe}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
