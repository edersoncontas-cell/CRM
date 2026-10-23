import { NextRequest, NextResponse } from "next/server";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { googleContatosDisponivel, googlePrecisaReconectar, sincronizarContatosGoogle } from "@/lib/google-contatos";
import { MENSAGEM_RECONECTAR } from "@/lib/google-conexao-regra";
import { limparContatosIndesejados } from "@/lib/contatos-bloqueados";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Sincroniza a lista de clientes com o Google Contatos. Disparado pelo
// /api/cron/tudo a cada hora; sem conta Google conectada, não faz nada.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Mesmo sem Google, a limpeza de contatos que não são clientes roda de hora em hora.
  if (!(await googleContatosDisponivel())) {
    // Conexão caída não é defeito do servidor: a tela já pede a reconexão.
    const pulado = (await googlePrecisaReconectar()) ? "google precisa ser reconectado" : "google não conectado";
    return NextResponse.json({ ok: true, pulado, limpeza: await limparContatosIndesejados() });
  }
  const r = await sincronizarContatosGoogle();
  // A primeira rodada depois da queda descobre o invalid_grant: também não é 500.
  if (!r.ok && r.erro === MENSAGEM_RECONECTAR) return NextResponse.json({ ok: true, pulado: "google precisa ser reconectado" });
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
