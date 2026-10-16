import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/session";

// Sin sesión válida, /admin redirige al login. (Cada página y acción vuelve a verificar en el servidor.)
export async function middleware(request: NextRequest) {
  const adminId = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!adminId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
