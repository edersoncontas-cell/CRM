import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { parseWhatsAppLines, montarChat, nomeDoArquivo, type ParsedChat } from "@/lib/whatsapp-export-parser";

function anthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// POST /api/cerebro/processar-historico
// Recebe o histórico de conversa exportado do WhatsApp (já parseado no cliente)
// O Cérebro lê tudo, atualiza o cadastro do cliente e o resumo do perfil.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, externalPhone, clienteId, historico, linhas } = body as {
      conversationId: string;
      externalPhone: string;
      clienteId?: string | null;
      historico: ParsedChat;
      linhas: Array<{ fromMe: boolean; sender: string | null; body: string; sentAt: string }>;
    };

    if (!conversationId || !historico || !linhas?.length) {
      return NextResponse.json({ ok: false, erro: "Dados insuficientes." }, { status: 400 });
    }

    // 1. Salva as mensagens no banco (deduplicando por sentAt + body)
    const existentes = await db.whatsAppMessage.findMany({
      where: { conversationId },
      select: { sentAt: true, body: true },
    });
    const setExistentes = new Set(existentes.map((m) => `${m.sentAt.toISOString()}|${m.body}`));

    const novas = linhas
      .filter((m) => {
        const key = `${new Date(m.sentAt).toISOString()}|${m.body}`;
        return !setExistentes.has(key);
      })
      .map((m) => ({
        conversationId,
        direction: (m.fromMe ? "OUT" : "IN") as "OUT" | "IN",
        body: m.body,
        senderName: m.sender,
        sentAt: new Date(m.sentAt),
        mediaType: null,
        mediaUrl: null,
        sendStatus: null,
        isDraft: false,
      }));

    if (novas.length > 0) {
      await db.whatsAppMessage.createMany({ data: novas });
      // Atualiza lastMessageAt da conversa
      const ultima = novas[novas.length - 1];
      await db.whatsAppConversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: ultima.sentAt },
      });
    }

    // 2. Monta o texto completo do histórico para o Cérebro ler
    const textoHistorico = linhas
      .map((m) => `[${m.sentAt}] ${m.fromMe ? "Você" : (m.sender || "Contato")}: ${m.body}`)
      .join("\n");

    // 3. Busca dados do cliente se existir
    let dadosCliente = "";
    let cliente = null;
    if (clienteId) {
      cliente = await db.cliente.findUnique({
        where: { id: clienteId },
        select: { id: true, nome: true, perfilIA: true, observacoes: true, maquinaComprada: true, municipio: { select: { nome: true } } },
      });
      if (cliente) {
        dadosCliente = `\n\n## Dados atuais do cliente no CRM:\n- Nome: ${cliente.nome}\n- Perfil IA: ${cliente.perfilIA || "não gerado"}\n- Observações: ${cliente.observacoes || "nenhuma"}\n- Máquina comprada: ${cliente.maquinaComprada || "nenhuma"}\n- Município: ${cliente.municipio?.nome || "não informado"}`;
      }
    }

    // 4. Pergunta ao Cérebro para analisar o histórico e gerar atualizações
    const prompt = `Você é o Cérebro do CRM do Ederson — vendedor de máquinas pesadas New Holland e Dynapac no sul do Espírito Santo.

Acabo de importar o histórico completo de uma conversa do WhatsApp com o contato ${historico.name} (telefone: ${externalPhone}).${dadosCliente}

## Histórico completo da conversa:
${textoHistorico.substring(0, 15000)}

## Sua tarefa:
1. Leia toda a conversa atentamente
2. Extraia informações relevantes: máquinas de interesse, valores mencionados, forma de pagamento, concorrentes citados, localização, cargo/empresa, urgência, objeções
3. Identifique o perfil do cliente (D/I/S/C se possível)
4. Gere um RESUMO do perfil atualizado (máx 400 palavras)
5. Sugira observações para o CRM

Responda em JSON com o seguinte formato exato:
{
  "perfilIA": "resumo completo do perfil do cliente baseado na conversa",
  "observacoes": "observações adicionais relevantes",
  "maquinaInteresse": "máquina(s) de interesse mencionada(s) ou null",
  "resumo": "resumo em 1-2 frases do que foi conversado para mostrar ao usuário"
}`;

    const resposta = await anthropicClient().messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const textoResposta = resposta.content[0].type === "text" ? resposta.content[0].text : "";

    // 5. Parseia o JSON da resposta do Cérebro
    let atualizacoes: { perfilIA?: string; observacoes?: string; maquinaInteresse?: string; resumo?: string } = {};
    try {
      const jsonMatch = textoResposta.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        atualizacoes = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Se não conseguir parsear JSON, usa o texto como perfilIA
      atualizacoes.perfilIA = textoResposta.substring(0, 1000);
      atualizacoes.resumo = "Histórico processado pelo Cérebro.";
    }

    // 6. Atualiza o cadastro do cliente se existir
    if (clienteId && atualizacoes.perfilIA) {
      const update: Record<string, string | null> = {};
      if (atualizacoes.perfilIA) update.perfilIA = atualizacoes.perfilIA;
      if (atualizacoes.observacoes) update.observacoes = atualizacoes.observacoes;
      if (atualizacoes.maquinaInteresse) update.maquinaComprada = atualizacoes.maquinaInteresse;

      if (Object.keys(update).length > 0) {
        await db.cliente.update({ where: { id: clienteId }, data: update });
      }
    }

    return NextResponse.json({
      ok: true,
      novasMensagens: novas.length,
      resumo: atualizacoes.resumo || `${novas.length} mensagens importadas e analisadas pelo Cérebro.`,
      perfilAtualizado: !!(clienteId && atualizacoes.perfilIA),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, erro: String(e) }, { status: 500 });
  }
}
