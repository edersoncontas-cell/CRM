import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { sendText } from "@/lib/zapi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Reenvia mensagens OUT que falharam (sendStatus=FAILED), até 3 tentativas.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const msgs = await db.whatsAppMessage.findMany({
    where: { direction: "OUT", sendStatus: "FAILED", retryCount: { lt: 3 }, isDraft: false },
    include: { conversation: true },
    take: 20,
  });

  let reenviados = 0;
  for (const m of msgs) {
    const corpo = m.body.replace(/^\*[^*]+:\*\n/, "");
    try {
      const id = await sendText(m.conversation.externalPhone, corpo);
      await db.whatsAppMessage.update({ where: { id: m.id }, data: { sendStatus: "SENT", zapiMessageId: id, retryCount: m.retryCount + 1, lastRetryAt: new Date() } });
      reenviados++;
    } catch (e) {
      await db.whatsAppMessage.update({ where: { id: m.id }, data: { retryCount: m.retryCount + 1, lastRetryAt: new Date(), lastSendError: String(e).slice(0, 200) } });
    }
  }

  return NextResponse.json({ ok: true, reenviados });
}
