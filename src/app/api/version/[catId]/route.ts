import { NextResponse } from "next/server";
import { getCategoryVersion } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Huella de cambios de una categoría publicada (la vista pública la consulta para refrescarse).
 * El CDN de Vercel la guarda 5 s (s-maxage): con 1.000 espectadores mirando, la base de datos
 * recibe ~1 consulta cada 5 s por categoría, no 100 por segundo. El navegador no la guarda.
 */
const CDN_CACHE = "public, max-age=0, s-maxage=5, stale-while-revalidate=10";

export async function GET(_: Request, { params }: { params: Promise<{ catId: string }> }) {
  const { catId } = await params;
  const v = await getCategoryVersion(catId);
  if (v === null) {
    return NextResponse.json({ error: "No encontrada" }, { status: 404, headers: { "Cache-Control": CDN_CACHE } });
  }
  return NextResponse.json({ v }, { headers: { "Cache-Control": CDN_CACHE } });
}
