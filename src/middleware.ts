import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, authAtivo, tokenEsperado } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  if (!authAtivo()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // Rotas públicas: login, auth e webhooks de WhatsApp (Meta e Z-API).
  // A Meta/Z-API não têm cookie; os webhooks se protegem pelo payload da origem.
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/whatsapp") ||
    pathname.startsWith("/api/zapi")
  ) {
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
  // Exclui arquivos estáticos do _next, favicon e extensões de mídia comuns.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico|mp4|pdf)).*)"],
};
