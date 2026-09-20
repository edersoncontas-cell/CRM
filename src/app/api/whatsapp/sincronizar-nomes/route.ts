import { NextResponse } from "next/server";
import { sincronizarNomesDosContatos } from "@/lib/whatsapp-nomes";
import { sincronizarFotosDosContatos } from "@/lib/whatsapp-fotos";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Puxa do provedor o nome E A FOTO dos contatos como estão no celular e corrige
// as conversas do CRM. Protegida pelo middleware de login, igual às outras
// rotas de tela (o cron tem o caminho dele, no vigia).
//
// Nome e foto vêm da MESMA lista de conversas do provedor, então andam juntos:
// separar em dois botões faria duas chamadas iguais para o mesmo dado.
//
// A foto não pode derrubar o nome: se a busca de fotos falhar, o nome — que é o
// que o vendedor de fato pediu neste botão primeiro — já está gravado.
export async function POST() {
  try {
    const r = await sincronizarNomesDosContatos();
    const fotos = await sincronizarFotosDosContatos().catch((e) => {
      console.error("[sincronizar-nomes] fotos:", e);
      return null;
    });
    return NextResponse.json({ ...r, fotosAtualizadas: fotos?.atualizadas ?? 0 });
  } catch (e) {
    console.error("[sincronizar-nomes]", e);
    return NextResponse.json({ erro: e instanceof Error ? e.message : "falha ao sincronizar os nomes" }, { status: 500 });
  }
}
