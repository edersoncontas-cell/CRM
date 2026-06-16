import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, authAtivo, tokenEsperado } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  if (!authAtivo()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const esperado = await tokenEsperado();
  if (cookie === esperado) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
