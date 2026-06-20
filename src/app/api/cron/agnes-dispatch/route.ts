import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWaSettings, cronAutorizado } from "@/lib/whatsapp-settings";
import { gerarRespostaWhatsAppIA } from "@/lib/ai";
import { sendText } from "@/lib/zapi";
import { inserirMensagem } from "@/lib/whatsapp-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Despacho da Agnes com debounce: responde conversas agendadas e silenciosas há ≥2 min.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const settings = await getWaSettings();
  const corte = new Date(Date.now() - 2 * 60 * 1000);

  const convs = await db.whatsAppConversation.findMany({
    where: { agnesScheduledAt: { not: null }, aiActive: true, lastMessageAt: { lte: corte } },
    take: 10,
  });

  let feitos = 0;
  for (const conv of convs) {
    await db.whatsAppConversation.update({ where: { id: conv.id }, data: { agnesScheduledAt: null } });
    const msgs = await db.whatsAppMessage.findMany({ where: { conversationId: conv.id }, orderBy: { sentAt: "desc" }, take: 20 });
    const hist = msgs.reverse().map((m) => `${m.direction === "OUT" ? "Eu" : "Cliente"}: ${m.body}`).join("\n");
    const reply = await gerarRespostaWhatsAppIA(hist);
    if (!reply) continue;

    if (settings.auditMode) {
      await inserirMensagem(conv.id, {
        direction: "OUT", body: reply, origin: "CRM", operatorDisplayName: "Agnes (rascunho)",
        isDraft: true, draftStatus: "PENDING",
      });
    } else {
      try {
        const id = await sendText(conv.externalPhone, reply, "Agnes");
        await inserirMensagem(conv.id, { direction: "OUT", body: reply, origin: "CRM", operatorDisplayName: "Agnes", zapiMessageId: id, sendStatus: "SENT" });
      } catch (e) {
        console.error("[agnes] envio falhou:", e);
      }
    }
    feitos++;
  }

  return NextResponse.json({ ok: true, feitos });
}
