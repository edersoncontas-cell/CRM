// Camada de dados do WhatsApp novo (Prisma). Usada pelo webhook e pela UI.

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { buildConvMatch, phoneLookupVariants } from "@/lib/whatsapp-routing";

const STATUS_RANK: Record<string, number> = { QUEUED: 0, FAILED: 0, SENT: 1, UNCONFIRMED: 1, DELIVERED: 2, READ: 3 };

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
  phone: string; lid: string | null; isGroup: boolean; contactName?: string | null; groupName?: string | null;
}) {
  let conv = await acharConversa(args.phone, args.lid, args.isGroup);
  if (conv) {
    if (!args.isGroup && args.lid && !conv.lid) {
      conv = await db.whatsAppConversation.update({ where: { id: conv.id }, data: { lid: args.lid } });
    }
    return { conv, criada: false };
  }
  const clienteId = !args.isGroup ? await acharClienteId(args.phone) : null;
  conv = await db.whatsAppConversation.create({
    data: {
      externalPhone: args.phone,
      lid: args.isGroup ? null : args.lid,
      isGroup: args.isGroup,
      contactName: args.contactName ?? null,
      groupName: args.groupName ?? null,
      clienteId,
      lastMessageAt: new Date(),
    },
  });
  return { conv, criada: true };
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

// Acha eco recente do CRM (mesmo corpo, com/sem prefixo *Operador:*) em ≤5 min.
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
