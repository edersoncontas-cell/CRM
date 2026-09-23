"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { registrarAudit } from "@/lib/audit";

// Apagar UMA mensagem da conversa, como no WhatsApp de verdade.
//
// O que isto faz e o que NÃO faz, porque a diferença importa:
//
// · Apaga do CRM. Só do CRM. O CRM não tem como apagar mensagem do aparelho
//   do cliente — o "apagar para todos" do WhatsApp é função do aplicativo
//   dele, e a API que o CRM usa não alcança isso. Mensagem ENTREGUE continua
//   com o cliente; some só daqui.
// · Mensagem que FALHOU nunca chegou a sair: some do CRM e acabou. É o caso
//   das que ficaram esperando o WhatsApp voltar — por isso elas aparecem no
//   Atendimento e não aparecem no celular dele.
//
// A tela é quem explica isso na confirmação, com o texto certo para cada
// caso; aqui fica só a regra.

export type ResultadoApagar = { ok: boolean; erro?: string };

export async function apagarMensagemAction(id: string): Promise<ResultadoApagar> {
  try {
    const m = await db.whatsAppMessage.findUnique({
      where: { id },
      select: { id: true, conversationId: true, direction: true, sendStatus: true, body: true },
    });
    if (!m) return { ok: false, erro: "Mensagem não encontrada (talvez já tenha sido apagada)." };

    await db.whatsAppMessage.delete({ where: { id } });

    // A conversa guarda lastMessageAt por fora das mensagens. Sem acertar,
    // a lista do Atendimento fica ordenada por uma data que não existe mais.
    const ultima = await db.whatsAppMessage.findFirst({
      where: { conversationId: m.conversationId },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }).catch(() => null);
    if (ultima) {
      await db.whatsAppConversation.update({
        where: { id: m.conversationId },
        // O resumo do relatório é cache preso a lastMessageAt: apagar mensagem
        // muda o que a conversa diz, então o resumo antigo é invalidado junto.
        data: { lastMessageAt: ultima.sentAt, resumoRelatorio: null, resumoRelatorioEm: null },
      }).catch(() => {});
    }

    await registrarAudit({
      acao: "cliente_atualizado", origem: "usuario",
      descricao: `Mensagem apagada do CRM (${m.direction === "OUT" ? "enviada" : "recebida"}${m.sendStatus === "FAILED" ? ", com falha" : ""}): "${m.body.slice(0, 80)}"`,
    }).catch(() => {});

    revalidatePath("/atendimento");
    return { ok: true };
  } catch (e) {
    console.error("[apagar-mensagem]", e);
    return { ok: false, erro: "Não deu para apagar agora." };
  }
}

/** Apagar várias de uma vez (seleção múltipla na conversa). */
export async function apagarMensagensAction(ids: string[]): Promise<{ ok: boolean; apagadas: number; erro?: string }> {
  const lista = Array.from(new Set(ids)).filter(Boolean);
  if (!lista.length) return { ok: true, apagadas: 0 };
  try {
    const msgs = await db.whatsAppMessage.findMany({
      where: { id: { in: lista } },
      select: { id: true, conversationId: true },
    });
    if (!msgs.length) return { ok: true, apagadas: 0 };
    const r = await db.whatsAppMessage.deleteMany({ where: { id: { in: msgs.map((m) => m.id) } } });

    for (const convId of [...new Set(msgs.map((m) => m.conversationId))]) {
      const ultima = await db.whatsAppMessage.findFirst({
        where: { conversationId: convId }, orderBy: { sentAt: "desc" }, select: { sentAt: true },
      }).catch(() => null);
      if (ultima) {
        await db.whatsAppConversation.update({
          where: { id: convId },
          data: { lastMessageAt: ultima.sentAt, resumoRelatorio: null, resumoRelatorioEm: null },
        }).catch(() => {});
      }
    }

    await registrarAudit({
      acao: "cliente_atualizado", origem: "usuario",
      descricao: `${r.count} mensagem(ns) apagada(s) do CRM na tela de Atendimento.`,
    }).catch(() => {});
    revalidatePath("/atendimento");
    return { ok: true, apagadas: r.count };
  } catch (e) {
    console.error("[apagar-mensagem] lote:", e);
    return { ok: false, apagadas: 0, erro: "Não deu para apagar agora." };
  }
}
