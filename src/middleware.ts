import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, authAtivo, producaoSemSenha, tokenEsperado, cookieOpts } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Rotas públicas: login, auth e SOMENTE os webhooks de WhatsApp (Meta e Z-API).
  // A Meta/Z-API não enviam cookie; os webhooks se protegem pelo payload da origem.
  // /api/cerebro/despacho-rapido também é chamado servidor-a-servidor (sem
  // cookie) pelo webhook via waitUntil — sem estar aqui, o fetch era
  // redirecionado para /login (200 OK, silencioso) e o Orientador nunca
  // rodava em produção. Protegido pelo próprio CRON_SECRET (x-cron-secret),
  // igual às rotas /api/cron/*.
  // As demais rotas /api/zapi/* (status, qr) exigem login — o navegador do
  // Ederson manda o cookie, então funcionam normalmente para ele.
  const rotaPublica =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks/zapi") ||
    pathname.startsWith("/api/zapi/webhook") ||
    pathname.startsWith("/api/cerebro/despacho-rapido") ||
    pathname.startsWith("/api/cron/");

  // Fail-closed: em produção, sem APP_PASSWORD o CRM ficaria público. Bloqueia
  // as telas com uma página de aviso; webhooks/crons seguem para suas próprias
  // rotas (que exigem CRON_SECRET/ZAPI_WEBHOOK_TOKEN independentemente).
  if (producaoSemSenha()) {
    if (rotaPublica || pathname.startsWith("/config-necessaria")) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/config-necessaria";
    return NextResponse.redirect(url);
  }

  if (!authAtivo()) return NextResponse.next();

  if (rotaPublica) {
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
