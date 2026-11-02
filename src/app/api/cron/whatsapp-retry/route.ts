import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronAutorizado } from "@/lib/whatsapp-settings";
import { sendText } from "@/lib/zapi";
import { tocarHeartbeat } from "@/lib/zeus/estado";
import { envioPausado } from "@/lib/whatsapp-pausa";
import { lerLimitesEnvio, enviadasHoje, enviosDaUltimaHora } from "@/lib/envio-guarda";
import { porQueNaoEnviar, proximaNoRitmo } from "@/lib/envio-limites";
import { ROTULO_ENVIO_MASSA, ROTULO_ANIVERSARIO } from "@/lib/piloto-regra";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Backoff simples: quanto mais tentativas já feitas, mais tempo esperamos
// antes da próxima (5 min, depois 15 min, depois 45 min) — evita bater na
// Z-API repetidamente quando ela está fora do ar por mais tempo.
const ESPERA_MIN_POR_TENTATIVA = [5, 15, 45];

// Reenvia mensagens OUT que falharam (sendStatus=FAILED), até 3 tentativas.
//
// Só o que o CRM manda sozinho (campanha e parabéns) e só TEXTO: o CRM não
// manda mais mensagem de conversa (o vendedor responde pelo celular), e uma
// campanha com foto reenviada como texto chegaria sem a foto. Só das últimas
// 24 h: campanha de ontem reenviada hoje é mensagem fora de hora.
//
// Reenvio é envio: passa pela pausa geral, pela janela/teto do dia e pelo
// ritmo por hora — antes passava por fora das três.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await tocarHeartbeat("whatsapp-retry");

  if (await envioPausado()) return NextResponse.json({ ok: true, reenviados: 0, bloqueio: "pausado" });
  const lim = await lerLimitesEnvio();
  let jaHoje = await enviadasHoje();
  if (porQueNaoEnviar(new Date(), jaHoje, lim)) return NextResponse.json({ ok: true, reenviados: 0, bloqueio: "janela" });
  const recentes = await enviosDaUltimaHora();
  if (!recentes) return NextResponse.json({ ok: true, reenviados: 0, bloqueio: "ritmo-sem-banco" });

  const msgs = await db.whatsAppMessage.findMany({
    where: {
      direction: "OUT", sendStatus: "FAILED", retryCount: { lt: 3 }, isDraft: false,
      mediaType: null,
      operatorDisplayName: { in: [ROTULO_ENVIO_MASSA, ROTULO_ANIVERSARIO] },
      sentAt: { gte: new Date(Date.now() - 24 * 3_600_000) },
    },
    include: { conversation: true },
    take: 20,
  });

  let reenviados = 0;
  for (const m of msgs) {
    const esperaMin = ESPERA_MIN_POR_TENTATIVA[Math.min(m.retryCount, ESPERA_MIN_POR_TENTATIVA.length - 1)];
    if (m.lastRetryAt && Date.now() - m.lastRetryAt.getTime() < esperaMin * 60 * 1000) continue;
    const agora = new Date();
    if (porQueNaoEnviar(agora, jaHoje, lim) || proximaNoRitmo(recentes, agora, lim)) break;
    const corpo = m.body.replace(/^\*[^*]+:\*\n/, "");
    recentes.push(agora);
    try {
      const id = await sendText(m.conversation.externalPhone, corpo);
      await db.whatsAppMessage.update({ where: { id: m.id }, data: { sendStatus: "SENT", zapiMessageId: id, retryCount: m.retryCount + 1, lastRetryAt: new Date() } });
      reenviados++;
      jaHoje++;
    } catch (e) {
      await db.whatsAppMessage.update({ where: { id: m.id }, data: { retryCount: m.retryCount + 1, lastRetryAt: new Date(), lastSendError: String(e).slice(0, 200) } });
    }
  }

  return NextResponse.json({ ok: true, reenviados });
}
