// Orientador de Vendas — copiloto comercial de IA (unifica o antigo
// gerarRespostaCerebro com a análise de coaching pedida pelo usuário: estágio,
// perfil do comprador, objeções, temperatura, probabilidade de fechamento,
// próxima ação, oportunidades perdidas e alertas). Roteada por llmTexto()
// (OpenAI > Anthropic > Groq, com fallback automático de provedor).
//
// IMPORTANTE (velocidade): a resposta que vai pro cliente é gerada por uma
// chamada RÁPIDA e SEPARADA (gerarRespostaRapida — só texto, ~200 tokens de
// saída) e enviada IMEDIATAMENTE. A análise completa do painel (11 campos,
// JSON estruturado, ~1200 tokens de saída) roda DEPOIS, sem bloquear o
// envio — pedir tudo numa chamada só fazia o cliente esperar a análise
// inteira terminar de ser GERADA (token a token) antes de receber a
// resposta, que era a causa raiz da lentidão reportada.

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
    oportunidadesPerdidas: [],
    alertas: [],
  };
}

const PERSONA = `Você é o Orientador de Vendas — um gerente comercial sênior, com décadas de experiência em venda
consultiva de máquinas pesadas da LINHA AMARELA / CONSTRUCTION (New Holland Construction e Dynapac) no
Brasil. Você domina SPIN Selling, Challenger Sale, venda consultiva, negociação baseada em valor,
psicologia da decisão, técnicas de fechamento e tratamento de objeções. Seu objetivo é aumentar a taxa
de conversão do vendedor — você não só responde mensagens, você ENSINA o vendedor a vender melhor.

Você conhece profundamente a linha New Holland Construction (escavadeiras, retroescavadeiras,
pás-carregadeiras, motoniveladoras) e os rolos compactadores Dynapac, seus concorrentes (Caterpillar,
Komatsu, Volvo, JCB, Case, XCMG, Sany) e suas aplicações em terraplenagem, construção e mineração.
Quando comparar marcas, seja ético e técnico, baseado nas necessidades do cliente — NUNCA deprecie um
concorrente.`;

const SYSTEM_BASE = `${PERSONA}

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
  "oportunidadesPerdidas": string[],       // perguntas que faltaram, objeções ignoradas, sinais de compra desperdiçados (vazio se não houver)
  "alertas": string[]                      // alertas curtos e acionáveis (ex: "Cliente esfriou", "Existe outro decisor", "Momento ideal para fechamento") — vazio se não houver nada digno de alerta
}
REGRAS CRÍTICAS:
- NUNCA invente dado (preço, prazo, especificação, nome) que não esteja no contexto fornecido.
- "objecoes" só pode conter itens da lista permitida, e só se realmente aparecerem na conversa.`;

// Gera SÓ a resposta pro cliente — chamada curta e rápida (texto puro, sem
// JSON, ~200 tokens de saída) para não fazer o cliente esperar a análise
// completa (abaixo) terminar de ser gerada. É isso que vai pro WhatsApp.
export async function gerarRespostaRapida(args: {
  historico: string;
  ultimasMensagens: string;
  contextoCliente: string;
  estilo: string | null;
}): Promise<string> {
  if (!iaHabilitada()) return "";

  const system = `${PERSONA}

## Contexto do cliente
${args.contextoCliente}
${args.estilo ? `\n## Estilo de comunicação do vendedor (imite)\n${args.estilo}` : ""}

## Regras absolutas
- Leia o HISTÓRICO COMPLETO pra entender onde estão na negociação, mas responda APENAS a ÚLTIMA mensagem do cliente.
- AVANCE a conversa: nunca repita uma pergunta que o cliente já respondeu antes no histórico, nem repita uma informação que você (ou o vendedor) já deu a ele. Releia o histórico antes de responder para checar isso.
- Só cumprimente ("bom dia", "boa tarde", etc.) se NINGUÉM do lado do vendedor já cumprimentou nesta conversa — se já houve saudação, vá direto ao ponto.
- Não repita a mesma abertura/frase de efeito usada em mensagens suas anteriores no histórico — varie a forma de começar a resposta.
- Se o cliente já deixou claro o que quer (ex: já disse qual máquina/modelo/opção específica lhe interessa), trate isso como resolvido e siga para o próximo passo da negociação — não peça de novo nem generalize a resposta.
- Seja breve (1-3 frases), como mensagem real de WhatsApp — natural e coerente com o histórico.
- NUNCA invente preços, prazos ou especificações que não estejam no contexto. Se faltar info, diga que vai verificar.
- NUNCA use emojis. Responda APENAS com o texto da mensagem, sem aspas nem comentários.`;

  try {
    const raw = await llmTexto(
      system,
      `=== HISTÓRICO ===\n${args.historico}\n\n=== ÚLTIMAS MENSAGENS (responda a última) ===\n${args.ultimasMensagens}`,
      { maxTokens: 220 }
    );
    return raw.trim();
  } catch (e) {
    await zeusReport(e, "gerarRespostaRapida (auto-resposta do WhatsApp)");
    return "";
  }
}

// Gera a análise completa do Orientador de Vendas (painel) — mais lenta
// (JSON estruturado, 10 campos), NÃO deve bloquear o envio da resposta.
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
${args.estilo ? `\n## Estilo de comunicação do vendedor\n${args.estilo}` : ""}`;

  try {
    const raw = await llmTexto(
      system,
      `=== HISTÓRICO COMPLETO DA CONVERSA ===\n${args.historico}\n\n=== ÚLTIMAS MENSAGENS (foco aqui) ===\n${args.ultimasMensagens}`,
      { maxTokens: 900, json: true }
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

  // 1) Resposta rápida primeiro — é o que o cliente está esperando. Não
  // bloqueia na análise completa (que roda depois, só pro painel).
  const reply = await gerarRespostaRapida({
    historico: args.historicoCompleto.slice(-2500),
    ultimasMensagens: args.ultimasMensagens,
    contextoCliente: args.contextoCliente,
    estilo: args.estilo,
  });

  let respondido = false;
  if (reply) {
    if (args.aiActive && !args.auditMode) {
      try {
        const id = await sendText(args.conv.externalPhone, reply);
        await inserirMensagem(args.conv.id, {
          direction: "OUT", body: reply, origin: "CRM",
          operatorDisplayName: "Orientador de Vendas", zapiMessageId: id, sendStatus: "SENT",
        });
        respondido = true;
      } catch (e) {
        console.error("[orientador] envio falhou:", e);
      }
    } else {
      // Sem envio automático (Cérebro desligado, ou modo auditoria ligado):
      // salva como rascunho — o vendedor vê a sugestão no painel e decide se envia.
      await inserirMensagem(args.conv.id, {
        direction: "OUT", body: reply, origin: "CRM", operatorDisplayName: "Orientador de Vendas (rascunho)",
        isDraft: true, draftStatus: "PENDING",
      });
      respondido = true;
    }
  }

  // 2) Análise completa (painel) — mais lenta, roda depois de já ter
  // respondido/rascunhado, sem atrasar o cliente.
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
    return { respondido };
  }

  const { alertas, ...campos } = analise;
  await db.orientadorAnalise.upsert({
    where: { clienteId: args.conv.clienteId },
    create: { clienteId: args.conv.clienteId, ...campos, melhorResposta: reply || null },
    update: { ...campos, melhorResposta: reply || undefined },
  });

  for (const mensagem of alertas) {
    await criarAlertaOrientadorSeNovo(args.conv.clienteId, mensagem).catch(() => {});
  }

  return { respondido };
}
