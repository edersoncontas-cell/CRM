import { NextResponse } from "next/server";
import { sincronizarNomesDosContatos } from "@/lib/whatsapp-nomes";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Puxa do provedor o nome dos contatos como estão na agenda do celular e
// corrige as conversas do CRM. Protegida pelo middleware de login, igual às
// outras rotas de tela (o cron tem o caminho dele, no vigia).
export async function POST() {
  try {
    const r = await sincronizarNomesDosContatos();
    return NextResponse.json(r);
  } catch (e) {
    console.error("[sincronizar-nomes]", e);
    return NextResponse.json({ erro: e instanceof Error ? e.message : "falha ao sincronizar os nomes" }, { status: 500 });
  }
}
