import { NextResponse } from "next/server";
import { runBackup } from "@/lib/backup";

// Vercel Cron la llama una vez al día (vercel.json). No devuelve datos y crea como máximo una copia
// por día, así que no hace falta una clave: llamarla de más no hace daño.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const r = await runBackup();
    return NextResponse.json(
      r.created ? { ok: true, date: r.info.date, size: r.info.size, tables: r.counts } : { ok: true, skipped: r.reason },
    );
  } catch (e) {
    console.error("[copia] Falló la copia de seguridad", e);
    throw e; // queda registrado y avisa a los administradores (instrumentation.ts)
  }
}
