import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWaSettings, cronAutorizado } from "@/lib/whatsapp-settings";
import { sendText } from "@/lib/zapi";
import { inserirMensagem } from "@/lib/whatsapp-store";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function anthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Gera resposta do Cérebro para uma conversa WhatsApp com contexto completo do CRM.
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

  const system = `Você é o **Cérebro** — assistente de vendas do Ederson, vendedor de máquinas pesadas New Holland e Dynapac no sul do Espírito Santo.

Seu papel no WhatsApp: responder mensagens de clientes de forma natural, cordial e estratégica, no estilo do Ederson. Você tem acesso ao histórico da conversa e ao perfil do cliente no CRM.

## Contexto do cliente
${contextoCliente}

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

// Despacho do Cérebro com debounce: responde conversas agendadas e silenciosas há ≥2 min.
export async function GET(req: NextRequest) {
  if (!cronAutorizado(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const settings = await getWaSettings();
  const corte = new Date(Date.now() - 2 * 60 * 1000);

  const convs = await db.whatsAppConversation.findMany({
    where: { agnesScheduledAt: { not: null }, aiActive: true, lastMessageAt: { lte: corte } },
    take: 10,
  });

  // Busca estilo do vendedor uma vez
  const estiloRecord = await db.estiloDeFala.findFirst().catch(() => null);
  const estilo = estiloRecord?.guia ?? null;

  let feitos = 0;
  for (const conv of convs) {
    await db.whatsAppConversation.update({ where: { id: conv.id }, data: { agnesScheduledAt: null } });

    const msgs = await db.whatsAppMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { sentAt: "desc" },
      take: 20,
    });
    const historico = msgs.reverse().map((m) => `${m.direction === "OUT" ? "Eu" : "Cliente"}: ${m.body}`).join("\n");

    // Busca dados do cliente no CRM se vinculado
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
    if (!reply) continue;

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
        console.error("[cerebro-dispatch] envio falhou:", e);
      }
    }
    feitos++;
  }

  return NextResponse.json({ ok: true, feitos });
}
