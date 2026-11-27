import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { FPV_LOGO_PNG_BASE64 } from "@/lib/fpv-logo";

// Declaración jurada y autorización de participación de menores, ya llenada con los datos de la
// inscripción. El TEXTO es un borrador base: la federación debe revisarlo (ver CLAUSES abajo).

export interface DeclarationData {
  minor: { name: string; document: string; birthdate: string; age: number | null; club: string | null };
  guardian: { name: string; document: string; relationship: string; phone: string };
  tournament: { name: string; category: string; dates: string; city: string };
  organizer: string;
  reference: string; // código corto de la inscripción
  site: string;
}

/** Cláusulas de la declaración. Editar aquí si la federación cambia el texto. */
export function clauses(d: DeclarationData): string[] {
  return [
    `Autorizo a ${d.minor.name} a participar en el torneo "${d.tournament.name}", categoría ${d.tournament.category}, que se realizará en ${d.tournament.city || "el lugar indicado por la organización"}${d.tournament.dates ? ` del ${d.tournament.dates}` : ""}, organizado por la ${d.organizer}.`,
    "Declaro que el/la menor se encuentra en buen estado de salud y apto/a físicamente para la práctica competitiva del vóley playa, y que no tengo conocimiento de impedimento médico alguno. Me comprometo a informar a la organización cualquier condición de salud relevante.",
    "Conozco y acepto los riesgos propios de la práctica deportiva y de la competencia al aire libre (exposición al sol, calor, esfuerzo físico, lesiones). Autorizo que, en caso de emergencia, reciba la atención médica que el personal del evento considere necesaria y que sea trasladado/a a un centro de salud si fuera preciso.",
    "Me comprometo a que el/la menor cumpla el reglamento del torneo y las indicaciones de la organización, los árbitros y las autoridades del evento, y a velar por su traslado y acompañamiento.",
    `Autorizo el uso de fotografías y videos del evento en los que aparezca el/la menor, únicamente con fines de difusión deportiva de la ${d.organizer} y sin fines comerciales.`,
    "Declaro bajo juramento que los datos consignados en este documento son verdaderos, sometiéndome a las responsabilidades que establece la ley en caso de falsedad.",
  ];
}

// Helvetica estándar usa la codificación WinAnsi: se reemplaza lo que no puede escribir (emoji, etc.).
const safe = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF‘’“”–—•…€]/g, "?");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of safe(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= width) line = test;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

const NAVY = rgb(0.047, 0.122, 0.247); // navy-900
const MUTED = rgb(0.31, 0.49, 0.73); // navy-400
const LINE = rgb(0.85, 0.9, 0.96);
const RED = rgb(0.78, 0.06, 0.18);

export async function declarationPdf(d: DeclarationData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Declaración jurada - ${safe(d.minor.name)}`);
  pdf.setAuthor(d.organizer);
  pdf.setCreator(d.site);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(FPV_LOGO_PNG_BASE64, "base64"));
  const M = 50; // margen
  const W = page.getWidth() - M * 2;
  let y = page.getHeight() - M;

  const text = (s: string, x: number, yy: number, size = 10, font = regular, color = NAVY) =>
    page.drawText(safe(s), { x, y: yy, size, font, color });

  // ── Encabezado ──
  page.drawImage(logo, { x: M, y: y - 64, width: 64, height: 64 });
  text(d.organizer.toUpperCase(), M + 78, y - 22, 13, bold);
  text("Vóley Playa · Circuito Nacional", M + 78, y - 38, 10, regular, MUTED);
  text(`Ref. ${d.reference}`, page.getWidth() - M - regular.widthOfTextAtSize(`Ref. ${d.reference}`, 9), y - 22, 9, regular, MUTED);
  y -= 84;
  page.drawRectangle({ x: M, y, width: W, height: 2, color: RED });
  y -= 26;

  const title = "DECLARACIÓN JURADA Y AUTORIZACIÓN DE PARTICIPACIÓN";
  text(title, M + (W - bold.widthOfTextAtSize(safe(title), 13)) / 2, y, 13, bold);
  y -= 16;
  const subtitle = "Menor de edad";
  text(subtitle, M + (W - regular.widthOfTextAtSize(subtitle, 10)) / 2, y, 10, regular, MUTED);
  y -= 26;

  // ── Datos ──
  const block = (heading: string, rows: [string, string][]) => {
    text(heading, M, y, 9, bold, MUTED);
    y -= 6;
    page.drawRectangle({ x: M, y, width: W, height: 0.8, color: LINE });
    y -= 14;
    const colW = W / 2;
    rows.forEach(([k, v], i) => {
      const x = M + (i % 2) * colW;
      text(k, x, y, 8, regular, MUTED);
      text(v || "____________________", x, y - 12, 10, bold);
      if (i % 2 === 1 || i === rows.length - 1) y -= 30;
    });
    y -= 4;
  };
  block("DATOS DEL MENOR", [
    ["Nombres y apellidos", d.minor.name],
    ["Documento", d.minor.document],
    ["Fecha de nacimiento", d.minor.birthdate + (d.minor.age !== null ? ` (${d.minor.age} años)` : "")],
    ["Club", d.minor.club ?? "—"],
  ]);
  block("DATOS DEL PADRE, MADRE O APODERADO", [
    ["Nombres y apellidos", d.guardian.name],
    ["Documento", d.guardian.document],
    ["Parentesco", d.guardian.relationship],
    ["Teléfono", d.guardian.phone],
  ]);
  block("TORNEO", [
    ["Torneo", d.tournament.name],
    ["Categoría", d.tournament.category],
    ["Fechas", d.tournament.dates],
    ["Lugar", d.tournament.city],
  ]);

  // ── Declaración ──
  const intro = `Yo, ${d.guardian.name || "____________________"}, identificado(a) con ${d.guardian.document || "____________"}, en mi calidad de ${(d.guardian.relationship || "padre/madre/apoderado").toLowerCase()} de ${d.minor.name}, DECLARO BAJO JURAMENTO Y AUTORIZO lo siguiente:`;
  for (const l of wrap(intro, regular, 9.5, W)) {
    text(l, M, y, 9.5);
    y -= 13;
  }
  y -= 4;
  clauses(d).forEach((c, i) => {
    const lines = wrap(c, regular, 9, W - 16);
    text(`${i + 1}.`, M, y, 9, bold);
    for (const l of lines) {
      text(l, M + 16, y, 9);
      y -= 12;
    }
    y -= 4;
  });

  // ── Firma ──
  y -= 6;
  text("Contacto de emergencia (nombre y teléfono): ______________________________________", M, y, 9);
  y -= 22;
  text("Lugar y fecha: ______________________________", M, y, 9);
  // La firma va a una altura fija, por encima del pie de página.
  y = 100;
  drawSignature(page, M, y, 230, regular, d);
  // Huella digital
  page.drawRectangle({ x: M + W - 90, y: y - 6, width: 80, height: 74, borderColor: LINE, borderWidth: 1 });
  text("Huella digital", M + W - 80, y - 20, 8, regular, MUTED);

  // ── Pie ──
  const foot = `Documento generado en ${d.site} para la inscripción ${d.reference}. Los datos se tratan según la Política de privacidad (Ley N.° 29733).`;
  for (const [i, l] of wrap(foot, regular, 7.5, W).entries()) text(l, M, 32 - i * 10, 7.5, regular, MUTED);

  return pdf.save();
}

function drawSignature(page: PDFPage, x: number, y: number, width: number, font: PDFFont, d: DeclarationData) {
  page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 0.8, color: NAVY });
  page.drawText("Firma del padre, madre o apoderado", { x, y: y - 13, size: 8.5, font, color: MUTED });
  page.drawText(safe(`${d.guardian.name || "Nombre: ____________________"}`), { x, y: y - 26, size: 8.5, font, color: NAVY });
  page.drawText(safe(`${d.guardian.document || "DNI: ____________"}`), { x, y: y - 38, size: 8.5, font, color: NAVY });
}
