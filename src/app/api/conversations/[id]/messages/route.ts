import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

// O CRM não envia mais mensagem de conversa (pedido do vendedor, 02/11): o
// WhatsApp aqui só ESPELHA o que ele manda e recebe pelo celular. A rota
// continua existindo para dizer isso a uma tela antiga aberta no celular, em
// vez de um 405 mudo.
export async function POST() {
  return NextResponse.json(
    { ok: false, erro: "O CRM não envia mais mensagem de conversa — responda pelo WhatsApp do celular. A mensagem aparece aqui sozinha." },
    { status: 410 },
  );
}
