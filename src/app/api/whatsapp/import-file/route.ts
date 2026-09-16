import { NextRequest, NextResponse } from "next/server";
import { acharOuCriarConversaPorNome, importarMensagens, acharConversa, telefoneSinteticoImportacao } from "@/lib/whatsapp-store";
import { deveDescartarContato } from "@/lib/filtro-contatos";
import { dataCorteWhatsApp, excluidaEm, mensagemAntiga } from "@/lib/whatsapp-corte";
import { limiteMensagens } from "@/lib/whatsapp-corte-regra";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ChatPayload = {
  name: string;
  isGroup: boolean;
  messages: Array<{ fromMe: boolean; sender: string | null; body: string; sentAt: string }>;
};

// Recebe conversas parseadas no navegador a partir de um arquivo .zip do WhatsApp,
// grava no banco sem duplicar. Sobe o texto das mensagens.
// Se conversaId for fornecido, vincula à conversa existente.
export async function POST(req: NextRequest) {
  let chats: ChatPayload[], conversaId: string | null = null;
  try {
    const payload = await req.json();
    chats = payload.chats;
    conversaId = payload.conversaId ?? null;
    if (!Array.isArray(chats)) throw new Error("inválido");
  } catch {
    return NextResponse.json({ ok: false, error: "payload inválido" }, { status: 400 });
  }

  if (!chats.length) return NextResponse.json({ ok: false, error: "nenhuma conversa lida" }, { status: 400 });

  const corte = await dataCorteWhatsApp();
  let totalConv = 0, totalMsg = 0, ignoradasAntigas = 0;
  for (const chat of chats) {
    const nome = chat.name?.trim();
    if (!nome || !chat.messages?.length) continue;
    // Contatos que não são clientes (contabilidade, banco, hotel…) não entram nem por importação.
    if (!chat.isGroup && (await deveDescartarContato(nome))) continue;

    // Data de corte: mensagens antigas não entram; conversa sem nada recente
    // nem é criada (senão a importação ressuscitava o que já foi apagado).
    const existingConv = conversaId ? await db.whatsAppConversation.findUnique({ where: { id: conversaId } }) : null;
    const limite = limiteMensagens(corte, existingConv ? null : await excluidaEm(telefoneSinteticoImportacao(nome)));
    const mensagens = chat.messages.filter((m) => !mensagemAntiga(new Date(m.sentAt), limite));
    if (!mensagens.length) { ignoradasAntigas++; continue; }

    let conv;
    if (existingConv) {
      conv = existingConv;
      // Atualiza o nome do contato se ainda não tinha
      if (!conv.contactName && !conv.isGroup) {
        await db.whatsAppConversation.update({
          where: { id: conv.id },
          data: { contactName: nome }
        });
      }
    } else {
      conv = await acharOuCriarConversaPorNome(nome, chat.isGroup);
    }

    totalConv++;

    const added = await importarMensagens(conv.id, mensagens, chat.isGroup);
    totalMsg += added;
    
    // Após importar, dispara o Cérebro para processar as novas mensagens
    if (added > 0) {
      try {
        await db.whatsAppConversation.update({
          where: { id: conv.id },
          data: { agnesScheduledAt: new Date() }
        });
      } catch (e) {
        console.error("Erro ao agendar cérebro:", e);
      }
    }
  }

  return NextResponse.json({ ok: true, conversas: totalConv, mensagens: totalMsg, ignoradasAntigas });
}
