// Orientador de Vendas — copiloto comercial de IA (unifica o antigo
// gerarRespostaCerebro com a análise de coaching pedida pelo usuário: estágio,
// perfil do comprador, objeções, temperatura, probabilidade de fechamento,
// próxima ação, oportunidades perdidas e alertas). Roteada por llmTexto()
// (Gemini > Groq > DeepSeek > OpenAI > Anthropic, com fallback automático
// de provedor: se um falhar, o próximo assume).
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
import { zeusReport } from "@/lib/zeus/eventos";
import { horaBrasilia, inicioDoDiaBrasilia } from "@/lib/utils";
import { getWaSettings } from "@/lib/whatsapp-settings";

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
  // true quando a conversa não deixou pendência (cliente agradeceu, assunto
  // resolvido, sem pergunta em aberto): o cliente sai de "aguardando resposta".
  conversaEncerrada: boolean;
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
    conversaEncerrada: false,
  };
}

const PERSONA = `Você é o ORIENTADOR DE VENDAS: gerente comercial sênior de máquinas pesadas da linha amarela
(New Holland Construction: escavadeiras, retroescavadeiras, pás-carregadeiras, motoniveladoras; Dynapac: rolos
compactadores) que acompanha, mensagem a mensagem, as conversas de WhatsApp de um vendedor de campo no Espírito
Santo. Você raciocina como um gerente que já fechou centenas de máquinas: lê a conversa inteira, entende quem é o
cliente (construtora, empreiteiro, pedreira, cafeicultor, prefeitura, locadora), o que ele realmente precisa (a
aplicação, o prazo, a forma de pagamento, a usada que tem), onde a negociação está e o que falta para fechar.

Método (siga nesta ordem, sempre):
1. LEIA TUDO. Nunca analise só a última mensagem. Identifique o que já foi perguntado e respondido.
2. DIAGNÓSTICO: aplicação e máquina (modelo ou categoria), urgência, dinheiro (à vista, financiamento, consórcio,
   usada na troca), decisor (quem decide? sócio, família, engenheiro), concorrente (marca e preço citados).
3. ESTÁGIO REAL: classifique pelo que ACONTECEU, não pelo que o vendedor gostaria.
4. PROBABILIDADE: some sinais concretos (pediu preço com aplicação definida, marcou visita, citou prazo, tem
   usada avaliada, financiamento em análise, respondeu rápido) e subtraia sinais de risco (só curiosidade, sem
   prazo, preço do concorrente muito abaixo, parou de responder, "vou pensar"). Seja honesto: 20% é 20%.
5. PRÓXIMA AÇÃO: uma só, específica, com o que fazer, como e quando (ex.: "Ligar hoje até 17h, confirmar quinta
   14h e levar a conta de custo por hora com a 580 na entrada"). Nunca "manter contato" ou "fazer follow-up".
6. RESPOSTA: curta, humana, no tom do vendedor, que RESPONDE o que o cliente perguntou e AVANÇA um passo
   (visita, dado, proposta, decisão). Uma pergunta fechada no fim. Sem emojis, sem "espero que esteja bem".

O que você NUNCA faz: inventar preço, prazo, especificação ou promoção; repetir pergunta já respondida; cumprimentar
de novo numa conversa em andamento; depreciar concorrente; escrever textão.`;

const SYSTEM_BASE = `${PERSONA}

Analise a NEGOCIAÇÃO COMPLETA abaixo (histórico integral da conversa + cadastro do cliente + negociações abertas +
visitas + condições de pagamento + alertas). Devolva SOMENTE um JSON válido, sem texto antes ou depois:
{
  "resumoNegociacao": string,             // 2-3 frases: quem é, o que quer, onde está, o que falta para fechar
  "estagioVenda": ${JSON.stringify(ESTAGIOS)},
  "perfilComprador": ${JSON.stringify(PERFIS)} + "|null",
  "objecoes": string[],                   // subconjunto de ${JSON.stringify(OBJECOES_VALIDAS)}, só as que apareceram de fato
  "probabilidadeFechamento": number,       // 0-100, pela regra do método (sinais concretos menos riscos)
  "probabilidadeExplicacao": string,       // 1 frase citando os 2-3 sinais que pesaram
  "temperatura": "muito_quente"|"quente"|"morna"|"fria",
  "proximaAcao": string,                   // uma ação: o quê + como + quando, com máquina/valor/concorrente reais
  "oportunidadesPerdidas": string[],       // perguntas que faltaram, sinais de compra ignorados, objeções não tratadas
  "alertas": string[],                     // só o que exige atenção agora (outro decisor, concorrente na frente, esfriou, momento de fechar)
  "conversaEncerrada": boolean             // true SÓ se a última troca não deixou nada pendente: cliente agradeceu/encerrou, dúvida respondida, sem pergunta em aberto e sem combinado a cumprir. Se o cliente ainda espera algo (preço, retorno, visita), false.
}
REGRAS CRÍTICAS:
- NUNCA invente dado (preço, prazo, especificação, nome) que não esteja no contexto.
- "objecoes" só com itens da lista permitida e que realmente apareceram.
- Se a conversa for só social/suporte, diga isso no resumo e use probabilidade baixa; não force uma venda.`;

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
- Leia o HISTÓRICO COMPLETO, mas responda APENAS a última mensagem do cliente, no ponto exato em que a conversa está.
- Primeiro RESPONDA o que foi perguntado (mesmo que seja "vou confirmar e te retorno até X"); depois AVANCE um passo: visita, dado concreto, proposta ou decisão. Termine com UMA pergunta fechada.
- Nunca repita pergunta já respondida nem informação já dada. Não cumprimente se já houve saudação na conversa.
- Se o cliente citou concorrente ou preço, reconheça sem depreciar e leve para valor (custo por hora, revenda, assistência, entrega), sem inventar números.
- Se o cliente pediu preço e a aplicação ainda não está clara, peça as 2 informações que faltam (aplicação e horas/mês, ou prazo e forma de pagamento) em vez de dar valor genérico.
- 1-3 frases, como mensagem real de WhatsApp de gente ocupada. Nada de textão.
- NUNCA invente preços, prazos ou especificações. Se faltar info, diga que vai verificar e quando retorna.
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
      { maxTokens: 900, json: true, raciocinio: true }
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
      conversaEncerrada: parsed.conversaEncerrada === true,
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
    historico: args.historicoCompleto.slice(-6000),
    ultimasMensagens: args.ultimasMensagens,
    contextoCliente: args.contextoCliente,
    estilo: args.estilo,
  });

  // Nada é enviado nem vira rascunho sozinho (decisão do vendedor): a melhor
  // resposta fica guardada no painel do Orientador e aparece dentro da
  // conversa quando ele chama o Cérebro. "respondido" fica true porque a
  // mensagem foi tratada (não precisa do fallback de resposta).
  const respondido = !!reply;

  // 2) Análise completa (painel).
  let analise: AnaliseOrientador;
  try {
    analise = await gerarAnaliseOrientador({
      historico: args.historicoCompleto.slice(-6000),
      ultimasMensagens: args.ultimasMensagens,
      contextoCliente: args.contextoCliente,
      contextoAcademia: args.contextoAcademia,
      estilo: args.estilo,
    });
  } catch (e) {
    await zeusReport(e, "gerarAnaliseOrientador (Orientador de Vendas)");
    return { respondido };
  }

  const { alertas, conversaEncerrada, ...campos } = analise;
  await db.orientadorAnalise.upsert({
    where: { clienteId: args.conv.clienteId },
    create: { clienteId: args.conv.clienteId, ...campos, melhorResposta: reply || null },
    update: { ...campos, melhorResposta: reply || undefined },
  });

  for (const mensagem of alertas) {
    await criarAlertaOrientadorSeNovo(args.conv.clienteId, mensagem).catch(() => {});
  }
  await aplicarConversaEncerrada(args.conv.clienteId, conversaEncerrada);

  return { respondido };
}

// A IA reconheceu que a conversa terminou sem pendência: o cliente sai de
// "aguardando resposta" (e some dos alertas "aguardando"/"top 5").
async function aplicarConversaEncerrada(clienteId: string, encerrada: boolean) {
  if (!encerrada) return;
  await db.cliente.updateMany({ where: { id: clienteId, aguardandoResposta: true }, data: { aguardandoResposta: false } }).catch(() => {});
}


// Análise sob demanda (botões "Reanalisar" e "Zerar e recomeçar"): roda o
// Orientador para a conversa e grava o painel e a melhor resposta, SEM criar
// rascunho nem enviar nada. Retorna ok=false com motivo quando não dá.
export async function analisarConversaSemResposta(conversationId: string): Promise<{ ok: boolean; erro?: string }> {
  if (!iaHabilitada()) return { ok: false, erro: "Nenhuma chave de IA configurada." };
  const { orcamentoIADisponivel, consumirOrcamentoIA } = await import("@/lib/zeus/estado");
  if (!(await orcamentoIADisponivel())) return { ok: false, erro: "Orçamento diário de IA esgotado. Tente amanhã." };
  const { montarContextoCliente, montarContextoAcademia } = await import("@/lib/zeus/cerebro-resposta");
  const { lerParametros } = await import("@/lib/parametros");

  const conv = await db.whatsAppConversation.findUnique({ where: { id: conversationId } });
  if (!conv?.clienteId) return { ok: false, erro: "Vincule a conversa a um cliente primeiro." };
  const p = await lerParametros();
  const [msgs, estilo] = await Promise.all([
    db.whatsAppMessage.findMany({ where: { conversationId, isDraft: false }, orderBy: { sentAt: "desc" }, take: 80 }),
    db.estiloDeFala.findFirst().catch(() => null),
  ]);
  if (msgs.length === 0) return { ok: false, erro: "Conversa sem mensagens." };
  msgs.reverse();
  const historico = msgs.map((m) => `[${m.sentAt.toLocaleDateString("pt-BR")} ${m.sentAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}] ${m.direction === "OUT" ? p.nomeVendedor : "Cliente"}: ${m.body}`).join("\n");
  const ultimas = msgs.slice(-5).map((m) => `${m.direction === "OUT" ? p.nomeVendedor : "Cliente"}: ${m.body}`).join("\n");
  const contextoCliente = await montarContextoCliente({ id: conv.id, contactName: conv.contactName, clienteId: conv.clienteId, externalPhone: conv.externalPhone });
  const contextoAcademia = montarContextoAcademia(historico);
  try {
    const ultimaDoCliente = msgs[msgs.length - 1].direction === "IN";
    const [analise, resposta] = await Promise.all([
      gerarAnaliseOrientador({ historico: historico.slice(-6000), ultimasMensagens: ultimas, contextoCliente, contextoAcademia, estilo: estilo?.guia ?? null }),
      ultimaDoCliente
        ? gerarRespostaRapida({ historico: historico.slice(-6000), ultimasMensagens: ultimas, contextoCliente, estilo: estilo?.guia ?? null })
        : Promise.resolve(""),
    ]);
    await consumirOrcamentoIA();
    const { alertas, conversaEncerrada, ...campos } = analise;
    await db.orientadorAnalise.upsert({
      where: { clienteId: conv.clienteId },
      create: { clienteId: conv.clienteId, ...campos, melhorResposta: resposta || null },
      update: { ...campos, ...(resposta ? { melhorResposta: resposta } : {}) },
    });
    for (const mensagem of alertas) await criarAlertaOrientadorSeNovo(conv.clienteId, mensagem).catch(() => {});
    await aplicarConversaEncerrada(conv.clienteId, conversaEncerrada);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e) };
  }
}
