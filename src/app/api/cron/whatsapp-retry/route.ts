import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { sendText } from "@/lib/zapi";
import { tocarHeartbeat } from "@/lib/zeus/estado";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Backoff simples: quanto mais tentativas já feitas, mais tempo esperamos
// antes da próxima (5 min, depois 15 min, depois 45 min) — evita bater na
// Z-API repetidamente quando ela está fora do ar por mais tempo.
const ESPERA_MIN_POR_TENTATIVA = [5, 15, 45];

// Reenvia mensagens OUT que falharam (sendStatus=FAILED), até 3 tentativas.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await tocarHeartbeat("whatsapp-retry");

  const msgs = await db.whatsAppMessage.findMany({
    where: { direction: "OUT", sendStatus: "FAILED", retryCount: { lt: 3 }, isDraft: false },
    include: { conversation: true },
    take: 20,
  });

  let reenviados = 0;
  for (const m of msgs) {
    const esperaMin = ESPERA_MIN_POR_TENTATIVA[Math.min(m.retryCount, ESPERA_MIN_POR_TENTATIVA.length - 1)];
    if (m.lastRetryAt && Date.now() - m.lastRetryAt.getTime() < esperaMin * 60 * 1000) continue;
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
