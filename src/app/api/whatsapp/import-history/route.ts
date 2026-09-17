import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listarChats, mensagensDoChat, fotoPerfil } from "@/lib/zapi";
import { acharOuCriarConversa, definirFotoSeVazia } from "@/lib/whatsapp-store";
import { isGroupChatId } from "@/lib/whatsapp-routing";
import { limiteImportacaoContato, mensagemAntiga, dataCorteWhatsApp, definirDataCorte } from "@/lib/whatsapp-corte";
import { inicioDoDiaBrasilia } from "@/lib/whatsapp-corte-regra";
import { registrarAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DIA = /^\d{4}-\d{2}-\d{2}$/;

function parseHist(m: Record<string, unknown>) {
  const id = String(m.messageId ?? m.id ?? "");
  const fromMe = m.fromMe === true;
  const tsRaw = Number(m.momment ?? m.moment ?? m.messageTimestamp ?? 0) || Date.now();
  const sentAt = new Date(tsRaw < 1e12 ? tsRaw * 1000 : tsRaw);
  let body = "";
  const t = m.text as { message?: string } | string | undefined;
  const img = m.image as { caption?: string } | undefined;
  const aud = m.audio as { transcription?: string } | undefined;
  const doc = m.document as { fileName?: string } | undefined;
  if (t && typeof t === "object" && t.message) body = t.message;
  else if (typeof t === "string") body = t;
  else if (img) body = img.caption || "📷 Imagem";
  else if (aud) body = aud.transcription || "🎵 Áudio";
  else if (m.video) body = "🎬 Vídeo";
  else if (doc) body = doc.fileName || "📄 Documento";
  return { id, fromMe, sentAt, body, senderName: (m.senderName as string) ?? null };
}

// Importa um LOTE de chats. A UI chama em loop até hasMore=false.
//
// `desde` (AAAA-MM-DD, opcional): o vendedor quer o que está no celular a
// partir desse dia. Se for antes da data de corte, o corte recua para esse dia
// — senão a importação traria as mensagens e o corte apagaria de novo.
export async function POST(req: NextRequest) {
  const { page = 1, pageSize = 5, messagesPerChat = 300, desde = null } = await req.json().catch(() => ({}));
  const desdeData = typeof desde === "string" && DIA.test(desde) ? inicioDoDiaBrasilia(desde) : null;

  if (page === 1 && desdeData) {
    const corte = await dataCorteWhatsApp();
    if (corte && desdeData < corte) {
      await definirDataCorte(desdeData);
      await registrarAudit({
        acao: "perfil_atualizado", origem: "usuario",
        descricao: `WhatsApp: importação do celular a partir de ${desde} — data de corte recuou para esse dia.`,
      }).catch(() => {});
    }
  }

  const chats = await listarChats(page, Math.min(Number(pageSize) || 5, 20));
  const porChat = Math.min(Math.max(Number(messagesPerChat) || 300, 50), 1000);

  let chatsProcessed = 0, messagesImported = 0, conversationsCreated = 0, chatsIgnoradosAntigos = 0;

  for (const chat of chats) {
    const isGroup = chat.isGroup === true || isGroupChatId(chat.phone);
    const phone = isGroup ? chat.phone : chat.phone.replace(/\D/g, "");
    // Grupos não entram no CRM (mesma regra do webhook) — nem na contagem.
    if (!phone || isGroup) continue;
    chatsProcessed++;

    // Só o que é mais recente que o limite entra (data escolhida ou corte, e
    // conversa apagada à mão nunca volta por aqui). Sem nada recente, a
    // conversa nem é criada.
    const limite = await limiteImportacaoContato(phone, desdeData);
    const raw = await mensagensDoChat(chat.phone, porChat);
    const parsed = raw.map(parseHist)
      .filter((m) => m.body && !mensagemAntiga(m.sentAt, limite))
      .sort((a, b) => +a.sentAt - +b.sentAt);
    if (!parsed.length) { chatsIgnoradosAntigos++; continue; }

    const { conv, criada } = await acharOuCriarConversa({
      phone, lid: null, isGroup, contactName: chat.name ?? null, groupName: null,
      photoUrl: chat.photo ?? null,
    });
    if (criada) conversationsCreated++;

    // Se ainda não temos foto, busca a foto de perfil (1 chamada extra).
    if (!conv.contactPhotoUrl && !chat.photo) {
      const f = await fotoPerfil(chat.phone).catch(() => null);
      if (f) await definirFotoSeVazia(conv.id, f);
    }

    const existentes = await db.whatsAppMessage.findMany({ where: { conversationId: conv.id }, select: { sentAt: true, body: true } });
    const chaves = new Set(existentes.map((e) => `${e.sentAt.getTime()}|${e.body.slice(0, 60)}`));
    const novas = parsed.filter((m) => !chaves.has(`${m.sentAt.getTime()}|${m.body.slice(0, 60)}`));
    if (!novas.length) continue;

    await db.whatsAppMessage.createMany({
      data: novas.map((m) => ({
        conversationId: conv.id,
        direction: m.fromMe ? "OUT" : "IN",
        body: isGroup && m.senderName && !m.fromMe ? `${m.senderName}: ${m.body}` : m.body,
        senderName: isGroup ? m.senderName : null,
        sentAt: m.sentAt,
        origin: m.fromMe ? "EXTERNAL" : null,
      })),
    });
    messagesImported += novas.length;

    // Conversa nova nasce com "agora" — vale a hora da última mensagem de
    // verdade. Conversa que já existia só avança (nunca volta no tempo, para
    // não passar por cima de mensagem que chegou ao vivo pelo webhook).
    const ultima = parsed[parsed.length - 1];
    if (criada || ultima.sentAt > conv.lastMessageAt) {
      await db.whatsAppConversation.update({ where: { id: conv.id }, data: { lastMessageAt: ultima.sentAt } });
    }
  }

  return NextResponse.json({
    ok: true,
    chatsProcessed,
    messagesImported,
    conversationsCreated,
    chatsIgnoradosAntigos,
    hasMore: chats.length >= pageSize,
    nextPage: page + 1,
  });
}
