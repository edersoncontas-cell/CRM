import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Ações sobre um rascunho do Orientador: só "discard" (descartar). "send"
// responde 410 — o CRM não envia mais mensagem de conversa.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { messageId, action } = await req.json().catch(() => ({}));
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

  // "send" não existe mais: o CRM não envia mensagem de conversa (02/11). A
  // sugestão do Orientador é aberta no WhatsApp do celular pela tela.
  return NextResponse.json(
    { ok: false, erro: "O CRM não envia mais mensagem de conversa — use “Abrir no WhatsApp” e mande pelo celular." },
    { status: 410 },
  );
}
