// Traz para o CRM o nome dos contatos como estão salvos na agenda do celular.
//
// Por que precisa existir: a única fonte de nome que o CRM tinha era o
// "pushName", que vem junto de cada mensagem. Só que o pushName é o nome que
// o PRÓPRIO contato escolheu no WhatsApp dele — renomear o contato na sua
// agenda não muda o pushName de ninguém, então a alteração nunca chegava
// aqui. O nome da agenda vem da lista de conversas do provedor, que a
// Evolution sincroniza do aparelho pareado.

import { db } from "@/lib/db";
import { listarChats } from "@/lib/zapi";
import { nomeQueDeveValer, isGroupChatId, phoneLookupVariants } from "@/lib/whatsapp-routing";

export type ResultadoNomes = {
  contatosLidos: number;
  nomesAtualizados: number;
  mudancas: { telefone: string; de: string | null; para: string }[];
};

/**
 * Lê a lista de conversas do provedor e corrige o nome das conversas do CRM.
 * Idempotente: rodar de novo sem ter mudado nada não altera nada.
 */
export async function sincronizarNomesDosContatos(limite = 100_000): Promise<ResultadoNomes> {
  const saida: ResultadoNomes = { contatosLidos: 0, nomesAtualizados: 0, mudancas: [] };

  const chats = await listarChats(1, limite).catch((e) => {
    console.error("[whatsapp-nomes] não deu para ler a lista do provedor:", e);
    return [];
  });

  if (!chats.length) return saida;

  // Uma consulta só, e o casamento é feito na memória. Buscar conversa por
  // conversa dava uma ida ao banco por contato — com algumas centenas de
  // conversas isso deixaria o cron lento à toa.
  const conversas = await db.whatsAppConversation.findMany({
    where: { isGroup: false },
    select: { id: true, externalPhone: true, contactName: true, lastMessageAt: true },
    orderBy: { lastMessageAt: "desc" },
  });
  const porVariante = new Map<string, (typeof conversas)[number]>();
  for (const c of conversas) {
    for (const v of phoneLookupVariants(c.externalPhone)) {
      if (!porVariante.has(v)) porVariante.set(v, c); // a mais recente ganha
    }
  }

  for (const chat of chats) {
    // Grupo tem nome próprio, que não vem da agenda de ninguém.
    if (chat.isGroup || isGroupChatId(chat.phone)) continue;
    const telefone = chat.phone.replace(/\D/g, "");
    if (!telefone) continue;
    saida.contatosLidos += 1;

    let conv: (typeof conversas)[number] | undefined;
    for (const v of phoneLookupVariants(telefone)) {
      conv = porVariante.get(v);
      if (conv) break;
    }
    if (!conv) continue; // conversa que o CRM não tem: não é trabalho daqui criar

    const novo = nomeQueDeveValer(conv.contactName, chat.nomeAgenda, chat.nomePerfil);
    if (!novo) continue;

    await db.whatsAppConversation.update({ where: { id: conv.id }, data: { contactName: novo } });
    saida.nomesAtualizados += 1;
    // Guarda só uma amostra: é para conferir que veio certo, não um relatório.
    if (saida.mudancas.length < 20) {
      saida.mudancas.push({ telefone, de: conv.contactName, para: novo });
    }
    conv.contactName = novo; // dois chats para a mesma conversa não repetem o update
  }

  return saida;
}
