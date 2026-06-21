import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendText } from "@/lib/zapi";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Ações sobre um rascunho da Agnes: "send" (aprovar e enviar) ou "discard" (descartar).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { messageId, action, body } = await req.json().catch(() => ({}));
  if (!messageId || !["send", "discard"].includes(action)) {
    return NextResponse.json({ ok: false, erro: "parâmetros inválidos" }, { status: 400 });
  }

  const draft = await db.whatsAppMessage.findUnique({ where: { id: messageId } });
  if (!draft || draft.conversationId !== params.id || !draft.isDraft) {
    return NextResponse.json({ ok: false, erro: "rascunho não encontrado" }, { status: 404 });
  }

  if (action === "discard") {
    await db.whatsAppMessage.delete({ where: { id: messageId } });
    return NextResponse.json({ ok: true, removed: messageId });
  }

  // send: usa o texto editado (se veio) e envia pela Z-API.
  const texto = (typeof body === "string" && body.trim()) ? body.trim() : draft.body;
  const conv = await db.whatsAppConversation.findUnique({ where: { id: params.id } });
  if (!conv) return NextResponse.json({ ok: false, erro: "conversa não encontrada" }, { status: 404 });

  try {
    const zapiMessageId = await sendText(conv.externalPhone, texto, "Agnes");
    const msg = await db.whatsAppMessage.update({
      where: { id: messageId },
      data: { body: texto, isDraft: false, draftStatus: "APPROVED", sendStatus: "SENT", zapiMessageId, operatorDisplayName: "Agnes", sentAt: new Date() },
    });
    await db.whatsAppConversation.update({ where: { id: conv.id }, data: { lastMessageAt: msg.sentAt } });
    return NextResponse.json({ ok: true, message: msg });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: String(e).slice(0, 200) }, { status: 500 });
  }
}
