import { NextResponse } from "next/server";
import { getCategoryVersion } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Huella de cambios de una categoría publicada (la vista pública la consulta para refrescarse). */
export async function GET(_: Request, { params }: { params: Promise<{ catId: string }> }) {
  const { catId } = await params;
  const v = await getCategoryVersion(catId);
  if (v === null) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ v }, { headers: { "Cache-Control": "no-store" } });
}
