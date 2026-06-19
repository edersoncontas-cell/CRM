import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, tokenEsperado, cookieOpts, authAtivo } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Re-autentica a partir do token salvo no armazenamento interno do app, repondo
// o cookie de sessão caso o iOS o tenha descartado ao fechar o PWA.
export async function POST(req: NextRequest) {
  if (!authAtivo()) return NextResponse.json({ ok: true });
  const { token } = await req.json().catch(() => ({ token: null }));
  const esperado = await tokenEsperado();
  if (token && token === esperado) {
    cookies().set(COOKIE_NAME, esperado, cookieOpts());
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
