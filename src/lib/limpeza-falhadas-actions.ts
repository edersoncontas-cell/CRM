"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { registrarAudit } from "@/lib/audit";
import { trechoInvariante, ehDoDisparo, type DisparoComFalhas } from "@/lib/limpeza-falhadas";

// Apagar as mensagens que FALHARAM de um disparo.
//
// Elas não são só sujeira na tela: o cron /api/cron/whatsapp-retry reenvia
// tudo que está em FAILED com menos de 3 tentativas. Enquanto existirem, elas
// voltam a sair no instante em que o envio for liberado — uma segunda rajada
// sem ninguém pedir. Apagar é o que desarma isso.
//
// Nada é apagado por adivinhação: o CRM mostra os disparos com a contagem, e
// só apaga o que ele escolher.

export type EstadoFalhadas = {
  disparos: DisparoComFalhas[];
  /** Mensagens com erro que NÃO casam com disparo nenhum. Só contagem: são as
   *  individuais dele, e não entram em apagar em massa. */
  outras: number;
};

const LIMITE_LEITURA = 20_000;

async function falhadasDoBanco() {
  return db.whatsAppMessage.findMany({
    where: { direction: "OUT", sendStatus: "FAILED", isDraft: false },
    select: { id: true, body: true, conversationId: true },
    take: LIMITE_LEITURA,
  });
}

export async function lerFalhadasAction(): Promise<EstadoFalhadas> {
  try {
    const [msgs, envios] = await Promise.all([
      falhadasDoBanco(),
      db.envioProgramado.findMany({
        orderBy: { quando: "desc" },
        take: 30,
        select: { id: true, texto: true, quando: true, status: true },
      }),
    ]);

    const casadas = new Set<string>();
    const disparos: DisparoComFalhas[] = [];
    for (const e of envios) {
      const trecho = trechoInvariante(e.texto);
      if (!trecho) continue;
      const minhas = msgs.filter((m) => ehDoDisparo(m.body, trecho));
      if (!minhas.length) continue;
      for (const m of minhas) casadas.add(m.id);
      disparos.push({
        envioId: e.id,
        texto: e.texto,
        trecho,
        quando: e.quando.toISOString(),
        status: e.status,
        falhadas: minhas.length,
        clientes: new Set(minhas.map((m) => m.conversationId)).size,
      });
    }
    disparos.sort((a, b) => b.falhadas - a.falhadas);
    return { disparos, outras: msgs.length - casadas.size };
  } catch (e) {
    console.error("[limpeza-falhadas] ler:", e);
    return { disparos: [], outras: 0 };
  }
}

/**
 * Apaga as mensagens com erro de UM disparo. Só as que falharam: o que foi
 * entregue fica na conversa, porque o cliente recebeu e a conversa tem que
 * continuar batendo com a realidade dele.
 */
export async function apagarFalhadasDoDisparoAction(envioId: string): Promise<{ ok: boolean; apagadas: number; erro?: string }> {
  try {
    const envio = await db.envioProgramado.findUnique({ where: { id: envioId }, select: { texto: true } });
    if (!envio) return { ok: false, apagadas: 0, erro: "Disparo não encontrado." };
    const trecho = trechoInvariante(envio.texto);
    if (!trecho) return { ok: false, apagadas: 0, erro: "O texto deste disparo é curto demais para separar com segurança." };

    const msgs = await falhadasDoBanco();
    const alvo = msgs.filter((m) => ehDoDisparo(m.body, trecho));
    if (!alvo.length) return { ok: true, apagadas: 0 };

    const conversas = [...new Set(alvo.map((m) => m.conversationId))];
    const r = await db.whatsAppMessage.deleteMany({ where: { id: { in: alvo.map((m) => m.id) } } });

    // A conversa guarda lastMessageAt por fora. Apagar mensagem sem acertar
    // isso deixaria a lista do Atendimento ordenada por uma data que não
    // existe mais em mensagem nenhuma.
    for (const id of conversas) {
      const ultima = await db.whatsAppMessage.findFirst({
        where: { conversationId: id },
        orderBy: { sentAt: "desc" },
        select: { sentAt: true },
      }).catch(() => null);
      if (ultima) {
        await db.whatsAppConversation.update({ where: { id }, data: { lastMessageAt: ultima.sentAt } }).catch(() => {});
      }
    }

    await registrarAudit({
      acao: "mensagem_enviada", origem: "usuario",
      descricao: `${r.count} mensagem(ns) com erro apagada(s) do disparo "${envio.texto.slice(0, 60)}…" em ${conversas.length} conversa(s).`,
    }).catch(() => {});

    revalidatePath("/atendimento");
    revalidatePath("/configuracoes");
    return { ok: true, apagadas: r.count };
  } catch (e) {
    console.error("[limpeza-falhadas] apagar:", e);
    return { ok: false, apagadas: 0, erro: "Não deu para apagar agora." };
  }
}
