// Contexto e geração de resposta do Cérebro para o auto-responder do WhatsApp.
// Compartilhado pelas duas rotas que despacham o Cérebro automaticamente:
// `api/cerebro/despacho-rapido` (debounce de 1s, caminho principal) e
// `api/cron/agnes-dispatch` (debounce de 2min, fallback do cron) — antes cada
// uma montava um contexto diferente; agora as duas usam o MESMO contexto rico
// (cliente, negociações abertas, visitas, alertas, tarefas, Academia).

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";
import { METODOLOGIAS, PERFIS_DISC, OBJECOES, FECHAMENTOS } from "@/lib/academia";
import { MODEL_CHAT } from "@/lib/ai/config";

function anthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Monta contexto rico do cliente para o Cérebro entender tudo antes de responder.
export async function montarContextoCliente(conv: {
  id: string;
  contactName: string | null;
  clienteId: string | null;
  externalPhone: string;
}): Promise<string> {
  if (!conv.clienteId) {
    return `Cliente: ${conv.contactName ?? conv.externalPhone}\nSituação: contato ainda não vinculado ao CRM.`;
  }

  try {
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
export function montarContextoAcademia(historico: string): string {
  const hist = historico.toLowerCase();

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
export async function gerarRespostaCerebro(args: {
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
      model: MODEL_CHAT,
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
