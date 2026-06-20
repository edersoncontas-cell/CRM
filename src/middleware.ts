import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, authAtivo, tokenEsperado, cookieOpts } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  if (!authAtivo()) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // Rotas públicas: login, auth e SOMENTE os webhooks de WhatsApp (Meta e Z-API).
  // A Meta/Z-API não enviam cookie; os webhooks se protegem pelo payload da origem.
  // As demais rotas /api/zapi/* (status, qr) exigem login — o navegador do
  // Ederson manda o cookie, então funcionam normalmente para ele.
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks/zapi") ||
    pathname.startsWith("/api/zapi/webhook")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const esperado = await tokenEsperado();
  if (cookie === esperado) {
    // Renova o cookie a cada visita (sessão deslizante de 1 ano) — você fica
    // logado mesmo fechando/reabrindo o app, sem precisar digitar a senha de novo.
    const res = NextResponse.next();
    res.cookies.set(COOKIE_NAME, esperado, cookieOpts());
    return res;
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  // Exclui arquivos estáticos do _next, favicon e extensões de mídia comuns.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico|mp4|pdf)).*)"],
};
