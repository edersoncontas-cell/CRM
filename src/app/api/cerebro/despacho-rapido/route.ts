import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWaSettings } from "@/lib/whatsapp-settings";
import { sendText } from "@/lib/zapi";
import { inserirMensagem } from "@/lib/whatsapp-store";
import { montarContextoCliente, montarContextoAcademia, gerarRespostaCerebro } from "@/lib/zeus/cerebro-resposta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/cerebro/despacho-rapido
// Chamado pelo webhook Z-API. Debounce de 1s (era 3s) para resposta mais rápida.
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
  if (!conv || !conv.aiActive) return NextResponse.json({ ok: true, ignorado: "conversa sem IA ativa" });
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
      take: 120, // histórico amplo — o Cérebro precisa ver toda a conversa
    }),
  ]);

  const estilo = estiloRecord?.guia ?? null;

  // Monta histórico completo (não invertido — ordem cronológica para o Cérebro ler)
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

  // Contexto completo do cliente (em paralelo com tudo mais)
  const contextoCliente = await montarContextoCliente({
    id: conv.id,
    contactName: conv.contactName,
    clienteId: conv.clienteId,
    externalPhone: conv.externalPhone,
  });

  const contextoAcademia = montarContextoAcademia(historicoCompleto);

  const reply = await gerarRespostaCerebro({
    historico: historicoCompleto.slice(-2500), // mais histórico para 120 msgs // máximo 6000 chars de histórico
    ultimasMensagens,
    contextoCliente,
    contextoAcademia,
    estilo,
  });

  if (!reply) return NextResponse.json({ ok: true, ignorado: "sem resposta da IA" });

  if (settings.auditMode) {
    await inserirMensagem(conv.id, {
      direction: "OUT", body: reply, origin: "CRM", operatorDisplayName: "Cérebro (rascunho)",
      isDraft: true, draftStatus: "PENDING",
    });
  } else {
    try {
      const id = await sendText(conv.externalPhone, reply);
      await inserirMensagem(conv.id, {
        direction: "OUT", body: reply, origin: "CRM",
        operatorDisplayName: "Cérebro", zapiMessageId: id, sendStatus: "SENT",
      });
    } catch (e) {
      console.error("[cerebro-despacho-rapido] envio falhou:", e);
    }
  }

  return NextResponse.json({ ok: true, respondido: true });
}
