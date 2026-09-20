import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWaSettings } from "@/lib/whatsapp-settings";
import { montarContextoCliente, montarContextoAcademia } from "@/lib/zeus/cerebro-resposta";
import { processarOrientador } from "@/lib/zeus/orientador";
import { deveReanalisar } from "@/lib/zeus/orientador-gatilho";
import { montarHistorico, montarUltimas } from "@/lib/zeus/historico-linha";
import { iaHabilitada } from "@/lib/ai";
import { lerParametros } from "@/lib/parametros";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/cerebro/despacho-rapido
// Chamado pelo webhook Z-API para TODA conversa com cliente vinculado (não só
// com o Cérebro/auto-resposta ligado — o Orientador de Vendas analisa e gera
// o painel de coaching mesmo quando o vendedor prefere responder manualmente).
// Debounce de 1s para agregar mensagens rápidas antes de analisar.
export async function POST(req: NextRequest) {
  const p = await lerParametros();
  const secret = req.headers.get("x-cron-secret") ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { conversationId, agendadoEm } = await req.json().catch(() => ({}));
  if (!conversationId) return NextResponse.json({ ok: false, erro: "conversationId obrigatório" }, { status: 400 });

  // Debounce reduzido: 1s (suficiente para agregar mensagens rápidas, muito mais veloz)
  await new Promise((r) => setTimeout(r, 1000));

  const conv = await db.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (!conv || !conv.clienteId) return NextResponse.json({ ok: true, ignorado: "conversa sem cliente vinculado" });
  if (!conv.agnesScheduledAt) return NextResponse.json({ ok: true, ignorado: "já processada" });

  if (agendadoEm) {
    const agendadoOriginal = new Date(agendadoEm);
    const diff = Math.abs(conv.agnesScheduledAt.getTime() - agendadoOriginal.getTime());
    if (diff > 5000) return NextResponse.json({ ok: true, ignorado: "nova mensagem recebida, despacho mais recente assumirá" });
  }

  await db.whatsAppConversation.update({ where: { id: conversationId }, data: { agnesScheduledAt: null } });

  // Busca dados em paralelo para máxima velocidade
  const [settings, estiloRecord, msgs] = await Promise.all([
    getWaSettings(),
    db.estiloDeFala.findFirst().catch(() => null),
    db.whatsAppMessage.findMany({
      where: { conversationId: conv.id, isDraft: false },
      orderBy: { sentAt: "asc" },
      take: 120, // histórico amplo — o Orientador precisa ver toda a negociação
    }),
  ]);

  const estilo = estiloRecord?.guia ?? null;

  // "Sim", "ok", figurinha, rajada de linhas curtas: não gasta uma análise
  // inteira (~10 mil tokens) — a leitura anterior continua valendo.
  const analiseAnterior = await db.orientadorAnalise.findUnique({ where: { clienteId: conv.clienteId }, select: { atualizadoEm: true } });
  const novas = msgs.filter((m) => m.direction === "IN" && (!analiseAnterior || m.sentAt > analiseAnterior.atualizadoEm));
  const decisao = deveReanalisar({ ultimaAnaliseEm: analiseAnterior?.atualizadoEm ?? null, novas: novas.map((m) => ({ texto: m.body, mediaType: m.mediaType })) });
  if (!decisao.reanalisar) return NextResponse.json({ ok: true, ignorado: decisao.motivo });

  // Histórico em ordem cronológica, com autor e anexo explícitos — ver
  // lib/zeus/historico-linha.ts (é o que impede o "Cliente enviou documentos"
  // quando quem anexou foi o vendedor, ou quando não houve anexo nenhum).
  const historicoCompleto = montarHistorico(msgs);
  // Últimas 5 mensagens para foco imediato
  const ultimasMensagens = montarUltimas(msgs);

  const contextoCliente = await montarContextoCliente({
    id: conv.id,
    contactName: conv.contactName,
    clienteId: conv.clienteId,
    externalPhone: conv.externalPhone,
  });
  const contextoAcademia = montarContextoAcademia(historicoCompleto);

  const { respondido } = await processarOrientador({
    conv, historicoCompleto, ultimasMensagens, contextoCliente, contextoAcademia, estilo,
    aiActive: conv.aiActive, auditMode: settings.auditMode,
  });

  // Falhou em gerar/enviar a resposta (instabilidade do provedor de IA, erro
  // da Z-API)? Devolve o agendamento que zeramos acima — sem isso o cron de
  // fallback (agnes-dispatch) nunca tentaria de novo e o cliente ficaria sem
  // resposta em silêncio. Só re-agenda se há IA configurada (senão viraria
  // retry infinito sem chance de sucesso).
  if (!respondido && iaHabilitada()) {
    await db.whatsAppConversation
      .update({ where: { id: conversationId }, data: { agnesScheduledAt: conv.agnesScheduledAt } })
      .catch(() => {});
  }

  return NextResponse.json({ ok: true, respondido });
}
