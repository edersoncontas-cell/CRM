import { NextResponse, type NextRequest } from "next/server";
import { googleConfigurado, urlAutorizacaoGoogle } from "@/lib/integrations/google";

export const dynamic = "force-dynamic";

// Início do OAuth: gera um `state` anti-CSRF (cookie de 10 min) e manda o
// vendedor para a tela de consentimento do Google. Protegida pelo login
// (middleware) — só quem está no CRM pode conectar a conta.
export async function GET(req: NextRequest) {
  const voltar = new URL("/configuracoes", req.nextUrl.origin);
  if (!googleConfigurado()) {
    voltar.searchParams.set("google", "naoconfigurado");
    return NextResponse.redirect(voltar);
  }
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(urlAutorizacaoGoogle(state));
  res.cookies.set("google_oauth_state", state, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600,
  });
  return res;
}
