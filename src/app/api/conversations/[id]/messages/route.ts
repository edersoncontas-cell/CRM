import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendText } from "@/lib/zapi";
import { inserirMensagem } from "@/lib/whatsapp-store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Lista as últimas 100 mensagens (ordem cronológica) e marca como acessada.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const msgs = await db.whatsAppMessage.findMany({
    where: { conversationId: params.id },
    orderBy: { sentAt: "desc" },
    take: 100,
  });
  await db.whatsAppConversation.update({ where: { id: params.id }, data: { lastAccessedAt: new Date() } }).catch(() => {});
  return NextResponse.json({ messages: msgs.reverse() });
}

// Envia uma mensagem de texto pela Z-API e grava como OUT (origin CRM).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { message } = await req.json().catch(() => ({ message: "" }));
  const texto = String(message ?? "").trim();
  if (!texto) return NextResponse.json({ ok: false, erro: "Mensagem vazia." }, { status: 400 });

  const conv = await db.whatsAppConversation.findUnique({ where: { id: params.id } });
  if (!conv) return NextResponse.json({ ok: false, erro: "Conversa não encontrada." }, { status: 404 });

  try {
    const zapiMessageId = await sendText(conv.externalPhone, texto);
    const msg = await inserirMensagem(conv.id, {
      direction: "OUT", body: texto, origin: "CRM", operatorDisplayName: "Você",
      zapiMessageId, sendStatus: "SENT",
    });
    return NextResponse.json({ ok: true, message: msg });
  } catch (e) {
    // grava como FAILED para o cron de reenvio reprocessar
    const msg = await inserirMensagem(conv.id, {
      direction: "OUT", body: texto, origin: "CRM", operatorDisplayName: "Você",
      sendStatus: "FAILED",
    });
    await db.whatsAppMessage.update({ where: { id: msg.id }, data: { lastSendError: String(e).slice(0, 200) } }).catch(() => {});
    return NextResponse.json({ ok: false, erro: String(e).slice(0, 200), message: msg }, { status: 500 });
  }
}
