import { NextResponse, type NextRequest } from "next/server";
import { ATHLETE_COOKIE, SESSION_COOKIE, readSession } from "@/lib/session";

// Primer filtro: sin sesión válida, /admin va al login de administradores y /cuenta al de
// atletas. (Cada página y acción vuelve a verificar en el servidor.)
const PUBLIC_ACCOUNT_PAGES = ["/cuenta/ingresar", "/cuenta/registro", "/cuenta/verificar", "/cuenta/recuperar", "/cuenta/restablecer"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const adminId = await readSession(request.cookies.get(SESSION_COOKIE)?.value, "admin");
    if (!adminId) return redirectTo(request, "/login");
  }

  if (pathname.startsWith("/cuenta") && !PUBLIC_ACCOUNT_PAGES.some((p) => pathname.startsWith(p))) {
    const athleteId = await readSession(request.cookies.get(ATHLETE_COOKIE)?.value, "athlete");
    if (!athleteId) return redirectTo(request, "/cuenta/ingresar");
  }

  return NextResponse.next();
}

function redirectTo(request: NextRequest, loginPath: string) {
  const url = request.nextUrl.clone();
  url.pathname = loginPath;
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/admin/:path*", "/cuenta/:path*"] };
