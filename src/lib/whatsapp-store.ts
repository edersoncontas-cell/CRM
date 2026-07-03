// Camada de dados do WhatsApp novo (Prisma). Usada pelo webhook e pela UI.

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { buildConvMatch, phoneLookupVariants } from "@/lib/whatsapp-routing";

const STATUS_RANK: Record<string, number> = { QUEUED: 0, FAILED: 0, SENT: 1, UNCONFIRMED: 1, DELIVERED: 2, READ: 3 };

/**
 * Retorna true se a string parece ser um número de telefone (só dígitos, +, -, espaços, parênteses).
 * Usada para proteger nomes reais de serem sobrescritos por números vindos da Z-API.
 */
function pareceNumeroTelefone(s: string): boolean {
  if (!s) return false;
  const stripped = s.replace(/[\s+\-().@]/g, "").replace(/@.*$/, "");
  return /^\d{6,}$/.test(stripped);
}

/**
 * Decide se o nome novo é melhor que o atual.
 * Regras:
 *  - Novo vazio/null → nunca atualiza
 *  - Novo parece número → nunca atualiza (mesmo se atual também for número)
 *  - Atual null/vazio → sempre atualiza com nome real
 *  - Atual parece número e novo é nome real → atualiza
 *  - Atual já é nome real → preserva (não sobrescreve)
 */
function deveAtualizarNome(atual: string | null, novo: string | null): boolean {
  if (!novo || !novo.trim()) return false;
  if (pareceNumeroTelefone(novo)) return false;           // Novo é número → nunca usa
  if (!atual || !atual.trim()) return true;               // Atual vazio → usa o novo
  if (pareceNumeroTelefone(atual)) return true;           // Atual é número, novo é nome → atualiza
  return false;                                            // Atual já é nome real → preserva
}

async function acharClienteId(phone: string): Promise<string | null> {
  const variants = phoneLookupVariants(phone);
  if (!variants.length) return null;
  const c = await db.cliente.findFirst({ where: { telefone: { in: variants } }, select: { id: true } });
  return c?.id ?? null;
}

export async function acharConversa(phone: string, lid: string | null, isGroup: boolean) {
  const where = buildConvMatch({ phone, lid, isGroup }) as Prisma.WhatsAppConversationWhereInput;
  return db.whatsAppConversation.findFirst({ where, orderBy: { lastMessageAt: "desc" } });
}

export async function acharOuCriarConversa(args: {
  phone: string; lid: string | null; isGroup: boolean;
  contactName?: string | null; groupName?: string | null; photoUrl?: string | null;
}) {
  let conv = await acharConversa(args.phone, args.lid, args.isGroup);
  if (conv) {
    const patch: Prisma.WhatsAppConversationUpdateInput = {};

    // Atualiza lid se ainda não tem
    if (!args.isGroup && args.lid && !conv.lid) patch.lid = args.lid;

    // Atualiza foto se ainda não tem
    if (args.photoUrl && !conv.contactPhotoUrl) patch.contactPhotoUrl = args.photoUrl;

    // ✅ CORREÇÃO PRINCIPAL: atualiza contactName se:
    //   - Atual é null/vazio (nunca teve nome) → preenche com o nome recebido
    //   - Atual parece número → substitui por nome real
    //   NUNCA sobrescreve nome real com número ou com null
    if (!args.isGroup && deveAtualizarNome(conv.contactName, args.contactName ?? null)) {
      patch.contactName = args.contactName;
    }
    if (args.isGroup && deveAtualizarNome(conv.groupName, args.groupName ?? null)) {
      patch.groupName = args.groupName;
    }

    if (Object.keys(patch).length) {
      conv = await db.whatsAppConversation.update({ where: { id: conv.id }, data: patch });
    }
    return { conv, criada: false };
  }

  // Conversa nova: cria com os dados disponíveis
  const clienteId = !args.isGroup ? await acharClienteId(args.phone) : null;
  try {
    conv = await db.whatsAppConversation.create({
      data: {
        externalPhone: args.phone,
        lid: args.isGroup ? null : args.lid,
        isGroup: args.isGroup,
        contactName: args.contactName && !pareceNumeroTelefone(args.contactName) ? args.contactName : null,
        groupName: args.groupName ?? null,
        contactPhotoUrl: args.photoUrl ?? null,
        clienteId,
        lastMessageAt: new Date(),
      },
    });
    return { conv, criada: true };
  } catch (e) {
    // Corrida: dois webhooks quase simultâneos para o mesmo contato podem
    // ambos não encontrar a conversa e tentar criar — @@unique([externalPhone])
    // rejeita o segundo. Em vez de propagar o erro, busca a conversa que o
    // outro request acabou de criar e segue normalmente.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existente = await acharConversa(args.phone, args.lid, args.isGroup);
      if (existente) return { conv: existente, criada: false };
    }
    throw e;
  }
}

// Para importação de arquivo (export do WhatsApp): casa pelo NOME, pois o
// arquivo não traz telefone. Se não existir, cria uma conversa "só histórico"
// com um telefone sintético (envio fica desabilitado até casar com o número real).
export async function acharOuCriarConversaPorNome(name: string, isGroup: boolean) {
  const existente = await db.whatsAppConversation.findFirst({
    where: isGroup
      ? { isGroup: true, groupName: { equals: name, mode: "insensitive" } }
      : { isGroup: false, contactName: { equals: name, mode: "insensitive" } },
    orderBy: { lastMessageAt: "desc" },
  });
  if (existente) return existente;

  const sintetico = "imp:" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const clienteId = !isGroup ? await acharClienteId(name) : null;
  return db.whatsAppConversation.create({
    data: {
      externalPhone: sintetico,
      isGroup,
      contactName: isGroup ? null : name,
      groupName: isGroup ? name : null,
      clienteId,
      lastMessageAt: new Date(0),
    },
  });
}

// Insere mensagens importadas, sem duplicar (chave = direção|timestamp|primeiros
// 60 chars). Ainda pode descartar duas mensagens LEGÍTIMAS iguais no mesmo
// instante e mesma direção (raro) — aceitável para importação de histórico.
export async function importarMensagens(
  conversationId: string,
  msgs: Array<{ fromMe: boolean; sender: string | null; body: string; sentAt: string }>,
  isGroup: boolean,
): Promise<number> {
  if (!msgs.length) return 0;
  const existentes = await db.whatsAppMessage.findMany({ where: { conversationId }, select: { sentAt: true, body: true, direction: true } });
  const chaves = new Set(existentes.map((e) => `${e.direction}|${e.sentAt.getTime()}|${e.body.slice(0, 60)}`));

  const novas = msgs.filter((m) => {
    const corpo = isGroup && m.sender && !m.fromMe ? `${m.sender}: ${m.body}` : m.body;
    const direction = m.fromMe ? "OUT" : "IN";
    return !chaves.has(`${direction}|${new Date(m.sentAt).getTime()}|${corpo.slice(0, 60)}`);
  });
  if (!novas.length) return 0;

  await db.whatsAppMessage.createMany({
    data: novas.map((m) => ({
      conversationId,
      direction: m.fromMe ? "OUT" : "IN",
      body: isGroup && m.sender && !m.fromMe ? `${m.sender}: ${m.body}` : m.body,
      senderName: isGroup ? m.sender : null,
      sentAt: new Date(m.sentAt),
      origin: m.fromMe ? "EXTERNAL" : null,
    })),
  });

  const ultima = new Date(msgs.reduce((a, b) => (new Date(b.sentAt) > new Date(a.sentAt) ? b : a)).sentAt);
  const conv = await db.whatsAppConversation.findUnique({ where: { id: conversationId }, select: { lastMessageAt: true } });
  if (conv && ultima > conv.lastMessageAt) {
    await db.whatsAppConversation.update({ where: { id: conversationId }, data: { lastMessageAt: ultima } });
  }
  return novas.length;
}

export async function definirFotoSeVazia(conversationId: string, photoUrl: string | null) {
  if (!photoUrl) return;
  await db.whatsAppConversation.updateMany({
    where: { id: conversationId, contactPhotoUrl: null },
    data: { contactPhotoUrl: photoUrl },
  });
}

export type NovaMensagem = {
  direction: "IN" | "OUT";
  body: string;
  sentAt?: Date;
  senderName?: string | null;
  operatorDisplayName?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaName?: string | null;
  transcript?: string | null;
  zapiMessageId?: string | null;
  origin?: string | null;
  sendStatus?: string | null;
  isDraft?: boolean;
  draftStatus?: string | null;
};

export async function inserirMensagem(conversationId: string, m: NovaMensagem) {
  const msg = await db.whatsAppMessage.create({
    data: {
      conversationId,
      direction: m.direction,
      body: m.body,
      sentAt: m.sentAt ?? new Date(),
      senderName: m.senderName ?? null,
      operatorDisplayName: m.operatorDisplayName ?? null,
      mediaUrl: m.mediaUrl ?? null,
      mediaType: m.mediaType ?? null,
      mediaName: m.mediaName ?? null,
      transcript: m.transcript ?? null,
      zapiMessageId: m.zapiMessageId ?? null,
      origin: m.origin ?? null,
      sendStatus: m.sendStatus ?? null,
      isDraft: m.isDraft ?? false,
      draftStatus: m.draftStatus ?? null,
    },
  });
  await db.whatsAppConversation.update({ where: { id: conversationId }, data: { lastMessageAt: msg.sentAt } });
  return msg;
}

export async function existeZapiId(zapiMessageId?: string | null): Promise<boolean> {
  if (!zapiMessageId) return false;
  return !!(await db.whatsAppMessage.findFirst({ where: { zapiMessageId }, select: { id: true } }));
}

export async function acharEcoRecente(conversationId: string, body: string) {
  const desde = new Date(Date.now() - 5 * 60 * 1000);
  const cands = await db.whatsAppMessage.findMany({
    where: { conversationId, direction: "OUT", sentAt: { gte: desde } },
    orderBy: { sentAt: "desc" }, take: 12,
  });
  const norm = (s: string) => s.replace(/^\*[^*]+:\*\n/, "").trim();
  const alvo = norm(body);
  return cands.find((m) => norm(m.body) === alvo) ?? null;
}

export async function atualizarStatusEntrega(ids: string[], novo: string) {
  if (!ids.length) return;
  const rank = STATUS_RANK[novo] ?? 0;
  const msgs = await db.whatsAppMessage.findMany({ where: { zapiMessageId: { in: ids } } });
  for (const m of msgs) {
    const atual = STATUS_RANK[m.sendStatus ?? ""] ?? -1;
    if (rank > atual) await db.whatsAppMessage.update({ where: { id: m.id }, data: { sendStatus: novo } });
  }
}

export async function curarZapiId(msgId: string, zapiMessageId: string) {
  await db.whatsAppMessage.update({ where: { id: msgId }, data: { zapiMessageId } });
}
