import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWaSettings, cronAutorizado } from "@/lib/whatsapp-settings";
import { montarContextoCliente, montarContextoAcademia } from "@/lib/zeus/cerebro-resposta";
import { processarOrientador } from "@/lib/zeus/orientador";
import { deveReanalisar } from "@/lib/zeus/orientador-gatilho";
import { tocarHeartbeat } from "@/lib/zeus/estado";
import { lerParametros } from "@/lib/parametros";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Despacho do Orientador com debounce: analisa/responde conversas agendadas e
// silenciosas há ≥2 min. É o FALLBACK do despacho rápido (que processa em ~1s
// a partir do webhook) — cobre o caso do fetch fire-and-forget do webhook não
// completar (função serverless encerrada antes da resposta). Usa o MESMO
// contexto rico (cliente, negociações, visitas, alertas, Academia) do despacho rápido.
export async function GET(req: NextRequest) {
  const p = await lerParametros();
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await tocarHeartbeat("agnes-dispatch");
  const settings = await getWaSettings();
  const corte = new Date(Date.now() - 2 * 60 * 1000);

  const convs = await db.whatsAppConversation.findMany({
    where: { agnesScheduledAt: { not: null }, clienteId: { not: null }, lastMessageAt: { lte: corte } },
    take: 10,
  });

  const estiloRecord = await db.estiloDeFala.findFirst().catch(() => null);
  const estilo = estiloRecord?.guia ?? null;

  let feitos = 0;
  for (const conv of convs) {
    const msgs = await db.whatsAppMessage.findMany({
      where: { conversationId: conv.id, isDraft: false },
      orderBy: { sentAt: "asc" },
      take: 120,
    });

    // Mesmo filtro do despacho rápido: só trivial desde a última análise → não
    // gasta IA; só limpa o agendamento.
    const analiseAnterior = await db.orientadorAnalise.findUnique({ where: { clienteId: conv.clienteId! }, select: { atualizadoEm: true } });
    const novas = msgs.filter((m) => m.direction === "IN" && (!analiseAnterior || m.sentAt > analiseAnterior.atualizadoEm));
    if (!deveReanalisar({ ultimaAnaliseEm: analiseAnterior?.atualizadoEm ?? null, novas: novas.map((m) => ({ texto: m.body, mediaType: m.mediaType })) }).reanalisar) {
      await db.whatsAppConversation.update({ where: { id: conv.id }, data: { agnesScheduledAt: null } });
      continue;
    }

    const historicoCompleto = msgs
      .map((m) => {
        const quem = m.direction === "OUT" ? p.nomeVendedor : "Cliente";
        const hr = m.sentAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        return `[${hr}] ${quem}: ${m.body}`;
      })
      .join("\n");
    const ultimasMensagens = msgs
      .slice(-5)
      .map((m) => `${m.direction === "OUT" ? p.nomeVendedor : "Cliente"}: ${m.body}`)
      .join("\n");

    const contextoCliente = await montarContextoCliente({
      id: conv.id,
      contactName: conv.contactName,
      clienteId: conv.clienteId,
      externalPhone: conv.externalPhone,
    });
    const contextoAcademia = montarContextoAcademia(historicoCompleto);

    // Se a geração falhar/vier vazia, deixa agnesScheduledAt intacto para
    // tentar de novo no próximo tick — só zera após sucesso.
    const { respondido } = await processarOrientador({
      conv, historicoCompleto, ultimasMensagens, contextoCliente, contextoAcademia, estilo,
      aiActive: conv.aiActive, auditMode: settings.auditMode,
    });
    if (!respondido) continue;

    await db.whatsAppConversation.update({ where: { id: conv.id }, data: { agnesScheduledAt: null } });
    feitos++;
  }

  return NextResponse.json({ ok: true, feitos });
}
