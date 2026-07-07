import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWaSettings } from "@/lib/whatsapp-settings";
import { montarContextoCliente, montarContextoAcademia } from "@/lib/zeus/cerebro-resposta";
import { processarOrientador } from "@/lib/zeus/orientador";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/cerebro/despacho-rapido
// Chamado pelo webhook Z-API para TODA conversa com cliente vinculado (não só
// com o Cérebro/auto-resposta ligado — o Orientador de Vendas analisa e gera
// o painel de coaching mesmo quando o vendedor prefere responder manualmente).
// Debounce de 1s para agregar mensagens rápidas antes de analisar.
export async function POST(req: NextRequest) {
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

  // Monta histórico completo (não invertido — ordem cronológica para a IA ler)
  const historicoCompleto = msgs
    .map((m) => {
      const quem = m.direction === "OUT" ? "Ederson" : "Cliente";
      const hora = m.sentAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return `[${hora}] ${quem}: ${m.body}`;
    })
    .join("\n");

  // Últimas 5 mensagens para foco imediato
  const ultimasMensagens = msgs
    .slice(-5)
    .map((m) => `${m.direction === "OUT" ? "Ederson" : "Cliente"}: ${m.body}`)
    .join("\n");

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

  return NextResponse.json({ ok: true, respondido });
}
