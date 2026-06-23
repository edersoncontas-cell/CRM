import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWaSettings } from "@/lib/whatsapp-settings";
import { sendText } from "@/lib/zapi";
import { inserirMensagem } from "@/lib/whatsapp-store";
import Anthropic from "@anthropic-ai/sdk";
import { resumoAcademia } from "@/lib/academia";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function anthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Gera resposta do Cérebro para uma conversa WhatsApp.
async function gerarRespostaCerebro(args: {
  historico: string;
  clienteNome: string | null;
  clienteStatus: string | null;
  clienteResumo: string | null;
  municipio: string | null;
  estilo: string | null;
}): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return "";

  const contextoCliente = args.clienteNome
    ? [
        `Cliente: ${args.clienteNome}`,
        args.municipio ? `Cidade: ${args.municipio}` : null,
        args.clienteStatus ? `Status no CRM: ${args.clienteStatus}` : null,
        args.clienteResumo ? `Resumo: ${args.clienteResumo}` : null,
      ]
      .filter(Boolean)
      .join("\n")
    : "Cliente não identificado no CRM.";

  const academiaSummary = resumoAcademia();

  const system = `Você é o **Cérebro** — assistente de vendas do Ederson, vendedor de máquinas pesadas New Holland e Dynapac no sul do Espírito Santo.

Seu papel no WhatsApp: responder mensagens de clientes de forma natural, cordial e estratégica, no estilo do Ederson. Você tem acesso ao histórico da conversa e ao perfil do cliente no CRM.

## Contexto do cliente
${contextoCliente}

## Base de conhecimento em vendas (Academia)
${academiaSummary}
Use esse conhecimento para responder de forma estratégica — mas sem usar jargão técnico com o cliente.

## Regras importantes
- Responda APENAS a última mensagem do cliente
- Seja breve (1-3 frases no máximo), como uma mensagem de WhatsApp real
- Tom: cordial, profissional, direto — como o Ederson fala
- NUNCA invente preços, prazos ou especificações
- Se não tiver a informação, peça educadamente ou diga que vai verificar
- Use linguagem informal mas educada (sem gírias exageradas)
- Não use emojis em excesso${args.estilo ? `\n\n## Estilo de comunicação do Ederson\n${args.estilo}` : ""}`;

  try {
    const msg = await anthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: `Histórico da conversa:\n${args.historico.slice(-3000)}\n\nResponda a última mensagem do cliente acima.` }],
    });
    const bloco = msg.content[0];
    return bloco.type === "text" ? bloco.text.trim() : "";
  } catch {
    return "";
  }
}

// POST /api/cerebro/despacho-rapido
// Chamado pelo webhook Z-API para acionar o Cérebro quase instantaneamente.
// Espera 3s de debounce (para agregar mensagens rápidas), então processa.
export async function POST(req: NextRequest) {
  // Segurança: verifica o secret
  const secret = req.headers.get("x-cron-secret") ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { conversationId, agendadoEm } = await req.json().catch(() => ({}));
  if (!conversationId) return NextResponse.json({ ok: false, erro: "conversationId obrigatório" }, { status: 400 });

  // Aguarda 3s de debounce para agregar mensagens rápidas
  await new Promise((r) => setTimeout(r, 3000));

  // Verifica se a conversa ainda está agendada (não foi cancelada/processada por outro worker)
  const conv = await db.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (!conv || !conv.aiActive) return NextResponse.json({ ok: true, ignorado: "conversa sem IA ativa" });
  if (!conv.agnesScheduledAt) return NextResponse.json({ ok: true, ignorado: "já processada" });

  // Verifica que o agendamento ainda é o original (não houve nova mensagem reposicionando)
  if (agendadoEm) {
    const agendadoOriginal = new Date(agendadoEm);
    const diff = Math.abs(conv.agnesScheduledAt.getTime() - agendadoOriginal.getTime());
    // Se houve nova mensagem (agnesScheduledAt foi atualizado), aguarda o novo despacho
    if (diff > 5000) return NextResponse.json({ ok: true, ignorado: "nova mensagem recebida, despacho mais recente assumirá" });
  }

  // Cancela o agendamento (evita que o cron processe novamente)
  await db.whatsAppConversation.update({ where: { id: conversationId }, data: { agnesScheduledAt: null } });

  const settings = await getWaSettings();
  const estiloRecord = await db.estiloDeFala.findFirst().catch(() => null);
  const estilo = estiloRecord?.guia ?? null;

  const msgs = await db.whatsAppMessage.findMany({
    where: { conversationId: conv.id },
    orderBy: { sentAt: "desc" },
    take: 20,
  });
  const historico = msgs.reverse().map((m) => `${m.direction === "OUT" ? "Eu" : "Cliente"}: ${m.body}`).join("\n");

  let clienteNome: string | null = conv.contactName;
  let clienteStatus: string | null = null;
  let clienteResumo: string | null = null;
  let municipio: string | null = null;

  if (conv.clienteId) {
    try {
      type ClienteRow = { nome: string; status: string | null; resumoTexto: string | null; municipioNome: string | null };
      const rows = await db.$queryRawUnsafe<ClienteRow[]>(`
        SELECT c.nome, c.status, c."resumoTexto",
               m.nome AS "municipioNome"
        FROM "Cliente" c
        LEFT JOIN "Municipio" m ON m.id = c."municipioId"
        WHERE c.id = $1
        LIMIT 1
      `, conv.clienteId);
      if (rows[0]) {
        clienteNome = rows[0].nome;
        clienteStatus = rows[0].status;
        clienteResumo = rows[0].resumoTexto;
        municipio = rows[0].municipioNome;
      }
    } catch {}
  }

  const reply = await gerarRespostaCerebro({ historico, clienteNome, clienteStatus, clienteResumo, municipio, estilo });
  if (!reply) return NextResponse.json({ ok: true, ignorado: "sem resposta da IA" });

  if (settings.auditMode) {
    await inserirMensagem(conv.id, {
      direction: "OUT", body: reply, origin: "CRM", operatorDisplayName: "Cérebro (rascunho)",
      isDraft: true, draftStatus: "PENDING",
    });
  } else {
    try {
      const id = await sendText(conv.externalPhone, reply, "Cérebro");
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
