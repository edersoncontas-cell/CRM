import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWaSettings } from "@/lib/whatsapp-settings";
import { sendText } from "@/lib/zapi";
import { inserirMensagem } from "@/lib/whatsapp-store";
import Anthropic from "@anthropic-ai/sdk";
import { METODOLOGIAS, PERFIS_DISC, OBJECOES, FECHAMENTOS } from "@/lib/academia";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function anthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Monta contexto rico do cliente para o Cérebro entender tudo antes de responder.
async function montarContextoCliente(conv: {
  id: string;
  contactName: string | null;
  clienteId: string | null;
  externalPhone: string;
}) {
  if (!conv.clienteId) {
    return `Cliente: ${conv.contactName ?? conv.externalPhone}\nSituação: contato ainda não vinculado ao CRM.`;
  }

  try {
    // Busca tudo do cliente em paralelo para máxima velocidade
    const [cliente, negociacoes, visitas] = await Promise.all([
      db.cliente.findUnique({
        where: { id: conv.clienteId },
        include: {
          municipio: true,
          frota: true,
          alertas: { where: { resolvido: false }, orderBy: { criadoEm: "desc" }, take: 5 },
          tarefas: { where: { coluna: { not: "concluido" } }, orderBy: { criadoEm: "desc" }, take: 5 },
        },
      }),
      db.negociacao.findMany({
        where: { clienteId: conv.clienteId, status: "aberta" },
        orderBy: { ultimoContato: "desc" },
        take: 5,
      }),
      db.visita.findMany({
        where: { clienteId: conv.clienteId },
        orderBy: { data: "desc" },
        take: 3,
      }),
    ]);

    if (!cliente) return `Cliente ID ${conv.clienteId} — dados não encontrados.`;

    const linhas: string[] = [
      `Nome: ${cliente.nome}`,
      cliente.municipio ? `Cidade: ${cliente.municipio.nome}` : null,
      `Status CRM: ${cliente.status}`,
      cliente.telefone ? `Telefone: ${cliente.telefone}` : null,
      cliente.jaComprou ? `Já comprou de nós anteriormente.` : `Ainda não comprou conosco.`,
      cliente.perfilDISC ? `Perfil DISC: ${cliente.perfilDISC}` : null,
      cliente.perfilIA ? `Perfil IA: ${cliente.perfilIA}` : null,
      cliente.abordagemIA ? `Abordagem sugerida: ${cliente.abordagemIA}` : null,
      cliente.resumoTexto ? `Resumo: ${cliente.resumoTexto}` : null,
      cliente.resumoMaquinas ? `Máquinas de interesse: ${cliente.resumoMaquinas}` : null,
      cliente.resumoCondicao ? `Condição de pagamento preferida: ${cliente.resumoCondicao}` : null,
      cliente.resumoValor ? `Valor negociado estimado: R$ ${cliente.resumoValor.toLocaleString("pt-BR")}` : null,
      cliente.interesseFuturo ? `Interesse futuro registrado${cliente.interesseFuturoData ? " para " + cliente.interesseFuturoData.toLocaleDateString("pt-BR") : ""}${cliente.interesseFuturoNota ? ": " + cliente.interesseFuturoNota : ""}` : null,
      cliente.observacoes ? `Observações: ${cliente.observacoes}` : null,
    ].filter(Boolean) as string[];

    if (cliente.frota.length > 0) {
      const frotaStr = cliente.frota.map((m) => `${m.marca} ${m.modelo}`).join(", ");
      linhas.push(`Frota atual: ${frotaStr}`);
    }

    if (negociacoes.length > 0) {
      linhas.push(`--- Negociações abertas ---`);
      for (const neg of negociacoes) {
        const partes = [
          neg.maquinaModelo ? `Máquina: ${neg.maquinaModelo}` : null,
          neg.valor ? `Valor: R$ ${neg.valor.toLocaleString("pt-BR")}` : null,
          neg.estagio ? `Estágio: ${neg.estagio}` : null,
          neg.termometro !== undefined ? `Termômetro: ${neg.termometro}/100` : null,
          neg.proximaAcao ? `Próxima ação: ${neg.proximaAcao}` : null,
          neg.concorrenteMencionado ? `Concorrente: ${neg.concorrenteMencionado}` : null,
        ].filter(Boolean).join(" | ");
        linhas.push(`• ${partes}`);
      }
    }

    if (visitas.length > 0) {
      linhas.push(`--- Visitas ---`);
      for (const v of visitas) {
        linhas.push(`• ${v.data.toLocaleDateString("pt-BR")}${v.observacao ? ": " + v.observacao : ""}`);
      }
    }

    if (cliente.proximaVisita) {
      linhas.push(`Próxima visita agendada: ${cliente.proximaVisita.toLocaleDateString("pt-BR")}${cliente.proximaVisitaNota ? " — " + cliente.proximaVisitaNota : ""}`);
    }

    if (cliente.alertas.length > 0) {
      linhas.push(`Alertas: ${cliente.alertas.map((a) => a.mensagem).join("; ")}`);
    }

    return linhas.join("\n");
  } catch {
    return `Cliente: ${conv.contactName ?? conv.externalPhone}`;
  }
}

// Monta trecho da Academia de Vendas relevante para o contexto da conversa.
function montarContextoAcademia(historico: string): string {
  const hist = historico.toLowerCase();

  // Seleciona metodologias relevantes com base nas palavras-chave da conversa
  const metRelevantes = METODOLOGIAS.filter((m) => {
    const palavras = m.quandoUsar.toLowerCase() + " " + m.resumo.toLowerCase();
    return (
      (hist.includes("preço") && palavras.includes("preço")) ||
      (hist.includes("caro") && palavras.includes("caro")) ||
      (hist.includes("aluguel") && palavras.includes("aluguel")) ||
      (hist.includes("concorrente") && palavras.includes("concorrente")) ||
      (hist.includes("prazo") && palavras.includes("prazo")) ||
      true // sempre inclui pelo menos as primeiras
    );
  }).slice(0, 3);

  // Objeções relevantes
  const objRelevantes = OBJECOES.filter((o) => {
    const kw = o.objecao.toLowerCase();
    return (
      (hist.includes("caro") && kw.includes("caro")) ||
      (hist.includes("barato") && kw.includes("barato")) ||
      (hist.includes("pensar") && kw.includes("pensar")) ||
      (hist.includes("sócio") && kw.includes("sócio")) ||
      (hist.includes("aluguel") && kw.includes("aluguel")) ||
      (hist.includes("concorrente") && kw.includes("concorrente")) ||
      (hist.includes("espera") && kw.includes("espera"))
    );
  }).slice(0, 2);

  // Fechamentos sugeridos
  const fechamentos = FECHAMENTOS.slice(0, 2);

  const linhas: string[] = ["## Técnicas de venda disponíveis:"];

  for (const m of metRelevantes) {
    linhas.push(`**${m.nome}**: ${m.resumo.slice(0, 120)}...`);
  }

  if (objRelevantes.length > 0) {
    linhas.push("\n## Respostas para objeções identificadas na conversa:");
    for (const o of objRelevantes) {
      linhas.push(`- Objeção "${o.objecao}": ${o.resposta}`);
    }
  }

  linhas.push("\n## Fechamentos recomendados:");
  for (const f of fechamentos) {
    linhas.push(`- ${f.nome}: ${f.exemplo}`);
  }

  // Dica de perfil DISC se detectável
  const perfis: Record<string, string> = {
    D: "direto, objetivo, foca em resultado e ROI",
    I: "caloroso, emocional, usa prova social e entusiasmo",
    S: "paciente, foca em segurança e garantia, zero pressão",
    C: "técnico, usa dados e comparativos, seja preciso",
  };
  const perfilDetectado = hist.includes("resultado") || hist.includes("rápido")
    ? "D" : hist.includes("garantia") || hist.includes("segurança")
    ? "S" : hist.includes("dados") || hist.includes("especificação")
    ? "C" : null;
  if (perfilDetectado) {
    const p = PERFIS_DISC.find((d) => d.letra === perfilDetectado);
    if (p) linhas.push(`\nPerfil detectado: ${p.nome} — ${perfis[perfilDetectado]}. Abordagem: ${p.abordagemWhatsApp}`);
  }

  return linhas.join("\n");
}

// Gera resposta do Cérebro com contexto completo do cliente e histórico integral.
async function gerarRespostaCerebro(args: {
  historico: string;           // histórico completo da conversa
  ultimasMensagens: string;    // últimas 5 msgs para foco imediato
  contextoCliente: string;     // dados completos do cliente no CRM
  contextoAcademia: string;    // técnicas de venda relevantes
  estilo: string | null;       // estilo de comunicação do Ederson
}): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return "";

  const system = `Você é o **Cérebro** — assistente de vendas do Ederson, vendedor de máquinas pesadas New Holland e Dynapac no sul do Espírito Santo.

## Contexto completo do cliente
${args.contextoCliente}

${args.contextoAcademia}
${args.estilo ? `\n## Estilo de comunicação do Ederson\n${args.estilo}` : ""}

## Regras absolutas
- Leia o HISTÓRICO COMPLETO da conversa para entender o contexto, onde estão na negociação e o que já foi discutido
- Responda APENAS à última mensagem do cliente de forma natural e coerente com todo o histórico
- Seja breve (1-3 frases), como mensagem real de WhatsApp
- Tom: cordial, direto, profissional — como o Ederson fala
- NUNCA invente preços, prazos ou especificações
- Se não tiver a informação, diga que vai verificar
- Use as técnicas de venda da Academia quando fizer sentido NATURAL — nunca de forma mecânica
- NUNCA use emojis — linguagem 100% profissional e direta
- Seja ULTRA-CONCISO: max 2-3 frases. Sem longas explicacoes
- Resposta direta e acionavel. Sem enrolacao`;

  try {
    const msg = await anthropic().messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 150,
      system,
      messages: [{
        role: "user",
        content: `=== HISTÓRICO COMPLETO DA CONVERSA ===\n${args.historico}\n\n=== ÚLTIMAS MENSAGENS (foco aqui) ===\n${args.ultimasMensagens}\n\nResponda a última mensagem do cliente de forma natural e coerente com todo o histórico acima.`,
      }],
    });
    const bloco = msg.content[0];
    return bloco.type === "text" ? bloco.text.trim() : "";
  } catch {
    return "";
  }
}

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
