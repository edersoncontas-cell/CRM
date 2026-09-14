import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendText, EnvioNaoConfirmadoError } from "@/lib/zapi";
import { inserirMensagem } from "@/lib/whatsapp-store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Lista as últimas 80 mensagens (ordem cronológica) e marca como acessada.
//   ?before=<id>  → página anterior (mais antigas que a mensagem informada)
//   ?q=<texto>    → busca dentro das mensagens desta conversa (até 60 resultados)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const before = req.nextUrl.searchParams.get("before");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  if (q) {
    const achadas = await db.whatsAppMessage.findMany({
      where: { conversationId: params.id, isDraft: false, body: { contains: q, mode: "insensitive" } },
      orderBy: { sentAt: "desc" },
      take: 60,
    });
    return NextResponse.json({ messages: achadas.reverse(), busca: q });
  }

  let cursor: Date | null = null;
  if (before) {
    const m = await db.whatsAppMessage.findUnique({ where: { id: before }, select: { sentAt: true } }).catch(() => null);
    cursor = m?.sentAt ?? null;
  }
  const msgs = await db.whatsAppMessage.findMany({
    where: { conversationId: params.id, ...(cursor ? { sentAt: { lt: cursor } } : {}) },
    orderBy: { sentAt: "desc" },
    take: 80,
  });
  if (!before) await db.whatsAppConversation.update({ where: { id: params.id }, data: { lastAccessedAt: new Date() } }).catch(() => {});
  return NextResponse.json({ messages: msgs.reverse(), temMais: msgs.length === 80 });
}

// Envia uma mensagem de texto pela Z-API e grava como OUT (origin CRM).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { message } = await req.json().catch(() => ({ message: "" }));
  const texto = String(message ?? "").trim();
  if (!texto) return NextResponse.json({ ok: false, erro: "Mensagem vazia." }, { status: 400 });
  if (texto.length > 4096) return NextResponse.json({ ok: false, erro: "Mensagem muito longa (máx. 4096 caracteres)." }, { status: 400 });

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
    // UNCONFIRMED: a Z-API pode ter entregue (sem erro de rede/API), só não
    // deu para confirmar o ID — não marcar como FAILED para o cron de reenvio
    // não duplicar a mensagem no cliente. FAILED é só para falha real.
    const unconfirmed = e instanceof EnvioNaoConfirmadoError;
    const msg = await inserirMensagem(conv.id, {
      direction: "OUT", body: texto, origin: "CRM", operatorDisplayName: "Você",
      sendStatus: unconfirmed ? "UNCONFIRMED" : "FAILED",
    });
    await db.whatsAppMessage.update({ where: { id: msg.id }, data: { lastSendError: String(e).slice(0, 200) } }).catch(() => {});
    return NextResponse.json({ ok: false, erro: String(e).slice(0, 200), message: msg }, { status: 500 });
  }
}
