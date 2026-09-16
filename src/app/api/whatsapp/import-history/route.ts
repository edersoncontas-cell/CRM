import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { listarChats, mensagensDoChat, fotoPerfil } from "@/lib/zapi";
import { acharOuCriarConversa, definirFotoSeVazia } from "@/lib/whatsapp-store";
import { isGroupChatId } from "@/lib/whatsapp-routing";
import { limiteMensagensContato, mensagemAntiga } from "@/lib/whatsapp-corte";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
export async function POST(req: NextRequest) {
  const { page = 1, pageSize = 5, messagesPerChat = 200 } = await req.json().catch(() => ({}));
  const chats = await listarChats(page, pageSize);

  let chatsProcessed = 0, messagesImported = 0, conversationsCreated = 0, chatsIgnoradosAntigos = 0;

  for (const chat of chats) {
    chatsProcessed++;
    const isGroup = chat.isGroup === true || isGroupChatId(chat.phone);
    const phone = isGroup ? chat.phone : chat.phone.replace(/\D/g, "");
    if (!phone) continue;
    // Grupos não entram no CRM (mesma regra do webhook).
    if (isGroup) continue;

    // Data de corte + conversa já apagada pelo vendedor: só o que é mais
    // recente que isso entra. Sem nada recente, a conversa nem é criada —
    // era assim que "importar" trazia de volta o que já tinha sido excluído.
    const limite = await limiteMensagensContato(phone);
    const raw = await mensagensDoChat(chat.phone, messagesPerChat);
    const parsed = raw.map(parseHist)
      .filter((m) => m.body && !mensagemAntiga(m.sentAt, limite))
      .sort((a, b) => +a.sentAt - +b.sentAt);
    if (!parsed.length) { chatsIgnoradosAntigos++; continue; }

    const { conv, criada } = await acharOuCriarConversa({
      phone, lid: null, isGroup, contactName: chat.name ?? null, groupName: null,
      photoUrl: chat.photo ?? null,
    });
    if (criada) conversationsCreated++;

    // Se ainda não temos foto, busca a foto de perfil na Z-API (1 chamada extra).
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

    const ultima = parsed[parsed.length - 1];
    await db.whatsAppConversation.update({ where: { id: conv.id }, data: { lastMessageAt: ultima.sentAt } });
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
