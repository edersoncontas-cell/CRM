import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, tokenEsperado, authAtivo } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Devolve o token da sessão SOMENTE se já houver um cookie válido (logado).
// O app guarda esse token no armazenamento interno para re-autenticar depois,
// caso o iOS descarte o cookie do PWA ao fechar o app.
export async function GET() {
  if (!authAtivo()) return NextResponse.json({ token: null });
  const esperado = await tokenEsperado();
  const atual = cookies().get(COOKIE_NAME)?.value;
  if (atual !== esperado) return NextResponse.json({ token: null }, { status: 401 });
  return NextResponse.json({ token: esperado });
}
