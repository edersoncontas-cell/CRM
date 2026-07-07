// Orientador de Vendas — copiloto comercial de IA (unifica o antigo
// gerarRespostaCerebro com a análise de coaching pedida pelo usuário: estágio,
// perfil do comprador, objeções, temperatura, probabilidade de fechamento,
// próxima ação, oportunidades perdidas e alertas). Uma ÚNICA chamada de IA,
// roteada por llmTexto() (OpenAI > Anthropic > Groq, com fallback automático
// de provedor) — em vez de duas chamadas fragmentadas como antes.

import { llmTexto, iaHabilitada } from "@/lib/ai";
import { db } from "@/lib/db";
import { sendText } from "@/lib/zapi";
import { inserirMensagem } from "@/lib/whatsapp-store";
import { zeusReport } from "@/lib/zeus/eventos";

export type Temperatura = "muito_quente" | "quente" | "morna" | "fria";

export type AnaliseOrientador = {
  resumoNegociacao: string;
  estagioVenda: string;
  perfilComprador: string | null;
  objecoes: string[];
  probabilidadeFechamento: number;
  probabilidadeExplicacao: string;
  temperatura: Temperatura;
  proximaAcao: string;
  melhorResposta: string;
  oportunidadesPerdidas: string[];
  alertas: string[];
};

const ESTAGIOS = [
  "Lead", "Primeiro contato", "Qualificação", "Visita realizada", "Proposta enviada",
  "Financiamento", "Negociação", "Aguardando decisão", "Fechamento", "Pós-venda",
];
const PERFIS = ["Técnico", "Financeiro", "Conservador", "Emocional", "Analítico", "Decisor", "Influenciador"];
const OBJECOES_VALIDAS = ["Preço", "Marca", "Concorrência", "Financiamento", "Prazo", "Confiança", "Sócio", "Família", "Medo de errar", "Insegurança"];

function fallback(motivo: string): AnaliseOrientador {
  return {
    resumoNegociacao: "",
    estagioVenda: "Lead",
    perfilComprador: null,
    objecoes: [],
    probabilidadeFechamento: 50,
    probabilidadeExplicacao: motivo,
    temperatura: "morna",
    proximaAcao: motivo,
    melhorResposta: "",
    oportunidadesPerdidas: [],
    alertas: [],
  };
}

const SYSTEM_BASE = `Você é o Orientador de Vendas — um gerente comercial sênior, com décadas de experiência em venda
consultiva de máquinas pesadas da LINHA AMARELA / CONSTRUCTION (New Holland Construction e Dynapac) no
Brasil. Você domina SPIN Selling, Challenger Sale, venda consultiva, negociação baseada em valor,
psicologia da decisão, técnicas de fechamento e tratamento de objeções. Seu objetivo é aumentar a taxa
de conversão do vendedor — você não só responde mensagens, você ENSINA o vendedor a vender melhor.

Você conhece profundamente a linha New Holland Construction (escavadeiras, retroescavadeiras,
pás-carregadeiras, motoniveladoras) e os rolos compactadores Dynapac, seus concorrentes (Caterpillar,
Komatsu, Volvo, JCB, Case, XCMG, Sany) e suas aplicações em terraplenagem, construção e mineração.
Quando comparar marcas, seja ético e técnico, baseado nas necessidades do cliente — NUNCA deprecie um
concorrente.

Analise a NEGOCIAÇÃO COMPLETA abaixo (histórico integral da conversa + cadastro do cliente + negociações
abertas + visitas + condições de pagamento/financiamento + alertas já existentes) — nunca considere
apenas a última mensagem isolada. Devolva SOMENTE um JSON válido, sem texto antes ou depois, com as chaves:
{
  "resumoNegociacao": string,             // 1-3 frases do estado atual da negociação
  "estagioVenda": ${JSON.stringify(ESTAGIOS)}, // escolha o que melhor descreve o momento atual
  "perfilComprador": ${JSON.stringify(PERFIS)} + "|null", // perfil do comprador, se identificável
  "objecoes": string[],                   // subconjunto de ${JSON.stringify(OBJECOES_VALIDAS)}, só as REALMENTE levantadas na conversa
  "probabilidadeFechamento": number,       // 0-100, sua estimativa honesta
  "probabilidadeExplicacao": string,       // 1 frase explicando o número
  "temperatura": "muito_quente"|"quente"|"morna"|"fria",
  "proximaAcao": string,                   // ação CONCRETA e específica pro vendedor tomar agora (cite máquina/concorrente/valor quando existirem)
  "melhorResposta": string,                // resposta pronta para a ÚLTIMA mensagem do cliente, no tom do vendedor, em português, natural e consultiva — NUNCA parecer um robô, NUNCA usar emojis
  "oportunidadesPerdidas": string[],       // perguntas que faltaram, objeções ignoradas, sinais de compra desperdiçados (vazio se não houver)
  "alertas": string[]                      // alertas curtos e acionáveis (ex: "Cliente esfriou", "Existe outro decisor", "Momento ideal para fechamento") — vazio se não houver nada digno de alerta
}
REGRAS CRÍTICAS:
- NUNCA invente dado (preço, prazo, especificação, nome) que não esteja no contexto fornecido.
- "objecoes" só pode conter itens da lista permitida, e só se realmente aparecerem na conversa.
- "melhorResposta" deve responder à ÚLTIMA mensagem do cliente, coerente com todo o histórico.`;

// Gera a análise completa do Orientador de Vendas para uma negociação — uma
// ÚNICA chamada de IA que substitui o antigo gerarRespostaCerebro (o campo
// melhorResposta cumpre o mesmo papel) e adiciona toda a inteligência de
// coaching pedida pelo usuário.
export async function gerarAnaliseOrientador(args: {
  historico: string;
  ultimasMensagens: string;
  contextoCliente: string;
  contextoAcademia: string;
  estilo: string | null;
}): Promise<AnaliseOrientador> {
  if (!iaHabilitada()) {
    return fallback("IA não configurada (defina OPENAI_API_KEY, ANTHROPIC_API_KEY ou GROQ_API_KEY).");
  }

  const system = `${SYSTEM_BASE}

## Contexto completo do cliente
${args.contextoCliente}

${args.contextoAcademia}
${args.estilo ? `\n## Estilo de comunicação do vendedor (imite em "melhorResposta")\n${args.estilo}` : ""}`;

  try {
    const raw = await llmTexto(
      system,
      `=== HISTÓRICO COMPLETO DA CONVERSA ===\n${args.historico}\n\n=== ÚLTIMAS MENSAGENS (foco aqui) ===\n${args.ultimasMensagens}`,
      { maxTokens: 1200, json: true }
    );
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json);

    const objecoes = Array.isArray(parsed.objecoes)
      ? parsed.objecoes.filter((o: unknown) => typeof o === "string" && OBJECOES_VALIDAS.includes(o))
      : [];
    const oportunidadesPerdidas = Array.isArray(parsed.oportunidadesPerdidas)
      ? parsed.oportunidadesPerdidas.filter((o: unknown) => typeof o === "string")
      : [];
    const alertas = Array.isArray(parsed.alertas)
      ? parsed.alertas.filter((a: unknown) => typeof a === "string")
      : [];
    const temperatura: Temperatura = ["muito_quente", "quente", "morna", "fria"].includes(parsed.temperatura)
      ? parsed.temperatura
      : "morna";
    const probabilidade = typeof parsed.probabilidadeFechamento === "number"
      ? Math.max(0, Math.min(100, Math.round(parsed.probabilidadeFechamento)))
      : 50;

    return {
      resumoNegociacao: typeof parsed.resumoNegociacao === "string" ? parsed.resumoNegociacao : "",
      estagioVenda: ESTAGIOS.includes(parsed.estagioVenda) ? parsed.estagioVenda : "Lead",
      perfilComprador: PERFIS.includes(parsed.perfilComprador) ? parsed.perfilComprador : null,
      objecoes,
      probabilidadeFechamento: probabilidade,
      probabilidadeExplicacao: typeof parsed.probabilidadeExplicacao === "string" ? parsed.probabilidadeExplicacao : "",
      temperatura,
      proximaAcao: typeof parsed.proximaAcao === "string" ? parsed.proximaAcao : "",
      melhorResposta: typeof parsed.melhorResposta === "string" ? parsed.melhorResposta.trim() : "",
      oportunidadesPerdidas,
      alertas,
    };
  } catch (e) {
    console.error("[orientador] falha na análise:", e);
    throw e;
  }
}

// Cria um Alerta para o cliente só se não existir um igual (mesma mensagem)
// ainda não resolvido — sem isso, cada mensagem nova recriaria o mesmo
// alerta ("Cliente esfriou" a cada troca de WhatsApp, por exemplo).
async function criarAlertaOrientadorSeNovo(clienteId: string, mensagem: string) {
  const existente = await db.alerta.findFirst({
    where: { clienteId, tipo: "orientador", mensagem, resolvido: false },
  });
  if (existente) return;
  await db.alerta.create({
    data: { clienteId, tipo: "orientador", mensagem, severidade: "media" },
  });
}

// Ponto único que liga a análise do Orientador à persistência (painel) e ao
// envio/rascunho da resposta no WhatsApp — chamado pelas duas rotas de
// despacho (despacho-rapido e o fallback do cron agnes-dispatch) para nunca
// duplicar essa lógica em dois lugares.
export async function processarOrientador(args: {
  conv: { id: string; clienteId: string | null; externalPhone: string };
  historicoCompleto: string;
  ultimasMensagens: string;
  contextoCliente: string;
  contextoAcademia: string;
  estilo: string | null;
  aiActive: boolean;
  auditMode: boolean;
}): Promise<{ respondido: boolean }> {
  if (!args.conv.clienteId) return { respondido: false };

  let analise: AnaliseOrientador;
  try {
    analise = await gerarAnaliseOrientador({
      historico: args.historicoCompleto.slice(-2500),
      ultimasMensagens: args.ultimasMensagens,
      contextoCliente: args.contextoCliente,
      contextoAcademia: args.contextoAcademia,
      estilo: args.estilo,
    });
  } catch (e) {
    await zeusReport(e, "gerarAnaliseOrientador (Orientador de Vendas)");
    return { respondido: false };
  }

  const { alertas, ...campos } = analise;
  await db.orientadorAnalise.upsert({
    where: { clienteId: args.conv.clienteId },
    create: { clienteId: args.conv.clienteId, ...campos },
    update: { ...campos },
  });

  for (const mensagem of alertas) {
    await criarAlertaOrientadorSeNovo(args.conv.clienteId, mensagem).catch(() => {});
  }

  const reply = campos.melhorResposta;
  if (!reply) return { respondido: false };

  if (args.aiActive && !args.auditMode) {
    try {
      const id = await sendText(args.conv.externalPhone, reply);
      await inserirMensagem(args.conv.id, {
        direction: "OUT", body: reply, origin: "CRM",
        operatorDisplayName: "Orientador de Vendas", zapiMessageId: id, sendStatus: "SENT",
      });
      return { respondido: true };
    } catch (e) {
      console.error("[orientador] envio falhou:", e);
      return { respondido: false };
    }
  }

  // Sem envio automático (Cérebro desligado, ou modo auditoria ligado): salva
  // como rascunho — o vendedor vê a sugestão no painel e decide se envia.
  await inserirMensagem(args.conv.id, {
    direction: "OUT", body: reply, origin: "CRM", operatorDisplayName: "Orientador de Vendas (rascunho)",
    isDraft: true, draftStatus: "PENDING",
  });
  return { respondido: true };
}
