import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { readBackup } from "@/lib/backup";

export const dynamic = "force-dynamic";

/** Descarga de una copia de seguridad. Solo el administrador general (tiene todos los datos). */
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin || !can(admin.grants, "staff.manage")) return new NextResponse("No autorizado", { status: 403 });
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const data = await readBackup(key);
  if (!data) return new NextResponse("Copia no encontrada", { status: 404 });
  const date = key.match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? "copia";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="torneos-copia-${date}.json.gz"`,
      "Cache-Control": "no-store",
    },
  });
}
