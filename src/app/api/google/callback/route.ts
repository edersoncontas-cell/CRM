import { NextResponse, type NextRequest } from "next/server";
import { trocarCodigoGoogle } from "@/lib/integrations/google";
import { registrarAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Volta do consentimento do Google: confere o `state`, troca o código por
// tokens e devolve o vendedor para Configurações com o resultado.
export async function GET(req: NextRequest) {
  const voltar = new URL("/configuracoes", req.nextUrl.origin);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const erroGoogle = req.nextUrl.searchParams.get("error");
  const esperado = req.cookies.get("google_oauth_state")?.value;

  const falhar = (msg: string) => {
    voltar.searchParams.set("google", "erro");
    voltar.searchParams.set("msg", msg.slice(0, 200));
    const res = NextResponse.redirect(voltar);
    res.cookies.delete("google_oauth_state");
    return res;
  };

  if (erroGoogle) return falhar(erroGoogle === "access_denied" ? "Você cancelou a autorização no Google." : `Google: ${erroGoogle}`);
  if (!code) return falhar("O Google não devolveu o código de autorização.");
  if (!state || !esperado || state !== esperado) return falhar("Sessão de autorização expirada. Clique em Conectar de novo.");

  try {
    const { email } = await trocarCodigoGoogle(code);
    await registrarAudit({
      acao: "perfil_atualizado", origem: "usuario",
      descricao: `Google Agenda e Contatos conectados${email ? ` (${email})` : ""}.`,
    }).catch(() => {});
    voltar.searchParams.set("google", "ok");
    const res = NextResponse.redirect(voltar);
    res.cookies.delete("google_oauth_state");
    return res;
  } catch (e) {
    return falhar(e instanceof Error ? e.message : String(e));
  }
}
