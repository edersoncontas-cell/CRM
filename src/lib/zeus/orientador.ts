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

import { llmTexto, iaHabilitada, janelaHistoricoAtual, modoCompactoAtual } from "@/lib/ai";
import { mensagemErroIA } from "@/lib/ai/erros";
import { db } from "@/lib/db";
import { sendText } from "@/lib/zapi";
import { zeusReport } from "@/lib/zeus/eventos";
import { horaBrasilia, inicioDoDiaBrasilia } from "@/lib/utils";
import { getWaSettings } from "@/lib/whatsapp-settings";
import { normalizarCoaching, coachingVazio, dicasParaResposta, type Coaching } from "@/lib/zeus/orientador-coaching";
import { PERSONA, ESTAGIOS, PERFIS, OBJECOES_VALIDAS, montarPromptOrientador, montarPromptCompacto } from "@/lib/zeus/orientador-prompt";
import { normalizarFatos, mudancasDaNegociacao, marcarVisitaNoRoteiro, FATOS_VAZIOS, type FatosNegociacao } from "@/lib/orientador-fatos";
import { textoParaPrompt } from "@/lib/orientador-notas";
import { normalizarPedidos, guardarPedidos, type PedidoOrientador } from "@/lib/orientador-pedidos";
import { recortarHistorico, MAX_MENSAGENS, JANELA_HISTORICO } from "@/lib/zeus/historico-janela";
import { soResumo, montarPromptResumoContato, limparResumo, analiseSoResumo } from "@/lib/zeus/orientador-resumo";
import { montarHistorico, montarUltimas, midiaDaConversa, type MidiaDaConversa } from "@/lib/zeus/historico-linha";
import { resumoConferido, frasesDerrubadas } from "@/lib/zeus/resumo-checagem";
import { corrigirTermos, corrigirTermosNaLista } from "@/lib/zeus/termos-pt";
import { lerAprendizadoOrientador } from "@/lib/zeus/orientador-aprendizado";
import { regrasParaPrompt } from "@/lib/contexto-negocio";
import { resumoDasEtapas } from "@/lib/zeus/cerebro-resposta";
import { Prisma } from "@prisma/client";

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
  // O que JÁ ficou combinado (com data/hora quando houver) e o que ainda falta.
  combinados: string[];
  pendencias: string[];
  // Coaching completo: personalidade, condução do vendedor, alerta do momento,
  // perguntas, roteiro até o fechamento, sinais e objeções com tratamento.
  coaching: Coaching;
  alertas: string[];
  // true quando a conversa não deixou pendência (cliente agradeceu, assunto
  // resolvido, sem pergunta em aberto): o cliente sai de "aguardando resposta".
  conversaEncerrada: boolean;
  // Os dados duros (máquina, valor, pagamento, cidade) lidos da conversa E da
  // nota do vendedor. Viram a ficha da negociação — ver aplicarFatos abaixo.
  fatos: FatosNegociacao;
  // Ordens que o vendedor deu na nota ("vincular à empresa X"). Nunca são
  // executadas sozinhas: viram proposta com botão de confirmar no painel.
  pedidos: PedidoOrientador[];
};


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
    combinados: [],
    pendencias: [],
    coaching: coachingVazio(),
    alertas: [],
    conversaEncerrada: false,
    fatos: { ...FATOS_VAZIOS },
    pedidos: [],
  };
}

// Gera SÓ a resposta pro cliente — chamada curta e rápida (texto puro, sem
// JSON, ~200 tokens de saída) para não fazer o cliente esperar a análise
// completa (abaixo) terminar de ser gerada. É isso que vai pro WhatsApp.
export async function gerarRespostaRapida(args: {
  historico: string;
  ultimasMensagens: string;
  contextoCliente: string;
  estilo: string | null;
  dicas?: string | null; // orientações do coaching (alerta, perfil, perguntas) — quando já analisado
}): Promise<string> {
  if (!iaHabilitada()) return "";

  const regras = await regrasParaPrompt("orientador").catch(() => "");
  const system = `${PERSONA}
${regras ? `\n${regras}\n` : ""}
## Contexto do cliente
${args.contextoCliente}
${args.dicas ? `\n## Orientações do coaching para ESTA resposta (siga)\n${args.dicas}` : ""}
${args.estilo ? `\n## Estilo de comunicação do vendedor — COPIE FIELMENTE (gírias, formalidade, tamanho das frases, jeito de cumprimentar e fechar). Aprendido automaticamente das mensagens reais dele; NUNCA soe genérico.\n${args.estilo}` : "\n## Estilo do vendedor ainda não aprendido — use um tom cordial, direto e regional (sul do ES); ele será aprendido sozinho assim que houver mensagens suficientes."}

## Regras absolutas
- Leia o HISTÓRICO COMPLETO, mas responda APENAS a última mensagem do cliente, no ponto exato em que a conversa está.
- Primeiro RESPONDA o que foi perguntado (mesmo que seja "vou confirmar e te retorno até X"); depois AVANCE um passo: visita, dado concreto, proposta ou decisão. Termine com UMA pergunta fechada.
- Nunca repita pergunta já respondida nem informação já dada. Não cumprimente se já houve saudação na conversa.
- O que já ficou combinado (visita com dia/hora aceita, proposta prometida) está combinado: não peça para confirmar de novo; avance para o passo seguinte.
- Ao propor visita, ofereça o dia de "MELHOR DIA PARA VISITAR ESTE CLIENTE" do contexto (você já estará perto) — com dia da semana e data — e feche com pergunta ("terça 22/09 de manhã fica bom?"). Sem essa informação no contexto, proponha um dia sem inventar rota.
- Se o cliente citou concorrente ou preço, reconheça sem depreciar e leve para valor (custo por hora, revenda, assistência, entrega), sem inventar números.
- Se o cliente pediu preço e a aplicação ainda não está clara, peça as informações que faltam (aplicação, prazo ou forma de pagamento) em vez de dar valor genérico.
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

/**
 * O roteiro reflete o que o vendedor contou ter feito.
 *
 * Fica aqui, e não só no prompt, porque "já visitei" tem de marcar a etapa
 * "Visita" SEMPRE — não só quando a IA lembra de mexer no roteiro.
 */
function comVisitaMarcada(coaching: Coaching, fatos: FatosNegociacao): Coaching {
  return { ...coaching, roteiro: marcarVisitaNoRoteiro(coaching.roteiro, fatos.visitaRealizada) };
}

/**
 * Lê o que o vendedor escreveu no campo "O que o Orientador precisa saber".
 *
 * Existe como função própria por causa do silêncio: antes as duas chamadas
 * faziam `.catch(() => null)` direto, então QUALQUER falha de leitura (a mais
 * provável sendo a coluna notaVendedor ainda não criada, quando a manutenção
 * não rodou) virava "não tem nota" — a análise seguia sem ela e ainda
 * avisava "pronto" na tela. Agora a falha aparece no log com o clienteId.
 */
async function lerNotaVendedor(clienteId: string): Promise<string | null> {
  try {
    const r = await db.orientadorAnalise.findUnique({
      where: { clienteId },
      select: { notaVendedor: true },
    });
    // Os contextos são vários e datados: chegam à IA em ordem, com o aviso de
    // que o mais novo ganha do mais velho quando se contradisserem.
    return textoParaPrompt(r?.notaVendedor);
  } catch (e) {
    console.error("[orientador] não deu para ler a nota do vendedor de", clienteId, e);
    return null;
  }
}

/**
 * Grava na ficha do cliente os fatos que o Orientador leu.
 *
 * Existe porque o card "Negociação" do painel lê a tabela Negociacao, e quem
 * alimentava essa tabela (analisarConversaIA, no pipeline do WhatsApp) nunca
 * enxergou o campo "O que o Orientador precisa saber". Resultado: o vendedor
 * escrevia a máquina e o valor fechado na mão, a leitura do Orientador até
 * mudava, e o card seguia dizendo "modelo ainda não definido".
 *
 * Agora quem lê as duas fontes é o Orientador, e é aqui que o que ele leu vira
 * dado. Nunca cria negociação — abrir negociação continua sendo decisão da
 * regra do pipeline; aqui só se completa a que já existe.
 */
/**
 * Grava na ficha da negociação o que foi lido DIRETO da caixa de contexto,
 * sem passar pela IA (ver lib/nota-fatos.ts).
 *
 * Entra com temNota=true porque foi o vendedor que escreveu: ele esteve lá, e
 * o que ele diz ganha do que estava gravado antes — exatamente a mesma regra
 * que vale quando a nota chega pela análise.
 */
export async function aplicarFatosDaNota(clienteId: string, fatos: FatosNegociacao): Promise<void> {
  await aplicarFatos(clienteId, fatos, true);
}

async function aplicarFatos(clienteId: string, fatos: FatosNegociacao, temNota: boolean): Promise<void> {
  try {
    // Cidade: só município do ES (municipioDoES já barrou o resto). Corrige
    // até uma cidade errada já gravada, porque foi assim que um cliente de
    // Guaçuí ficou marcado como sendo de Recife — e ninguém tinha como saber.
    if (fatos.municipio) {
      const muni = await db.municipio.upsert({
        where: { nome: fatos.municipio },
        create: { nome: fatos.municipio },
        update: {},
        select: { id: true },
      });
      await db.cliente.updateMany({
        where: { id: clienteId, NOT: { municipioId: muni.id } },
        data: { municipioId: muni.id },
      });
    }

    const aberta = await db.negociacao.findFirst({
      where: { clienteId, status: "aberta" },
      orderBy: { atualizadoEm: "desc" },
      select: { id: true, marca: true, maquinaModelo: true, valor: true, tipoPagamento: true, entradaValor: true, entradaPercentual: true, observacao: true },
    });
    if (!aberta) return;

    const mudancas = mudancasDaNegociacao(aberta, fatos, temNota);
    if (!Object.keys(mudancas).length) return;
    await db.negociacao.update({ where: { id: aberta.id }, data: mudancas });
  } catch (e) {
    // Falhar aqui não pode derrubar a análise: o painel ainda é útil sem a
    // ficha atualizada. Mas aparece no log, em vez de sumir calado.
    console.error("[orientador] não deu para gravar os fatos de", clienteId, e);
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
  licoes?: string[] | null; // lições do histórico real do vendedor (ver orientador-aprendizado.ts) — contexto leve, não regra
  notaVendedor?: string | null; // o que o vendedor escreveu na mão (ver abaixo)
}): Promise<AnaliseOrientador> {
  if (!iaHabilitada()) {
    return fallback("IA não configurada (defina OPENAI_API_KEY, ANTHROPIC_API_KEY ou GROQ_API_KEY).");
  }

  const regras = await regrasParaPrompt("orientador").catch(() => "");
  // A nota do vendedor abre a mensagem do usuário (ver orientador-prompt.ts):
  // no fim do system ela ficava atrás de ~12 mil caracteres e o modelo seguia
  // só a conversa, que é o "não atualiza com o campo preenchido" reportado.
  // MODO COMPACTO num provedor apertado. Ver lib/ai/orcamento-prompt.ts: com
  // o Groq gratuito, as instruções completas (5.438 tokens) mais a resposta
  // inflada (6.400) estouram o teto POR MINUTO antes de entrar uma linha de
  // conversa — e a análise falhava SEMPRE, não às vezes. O compacto gasta 640
  // tokens de instrução e cabe. Análise mais simples que roda todo dia vale
  // mais que análise completa que nunca roda; com Gemini, o completo volta.
  const compacto = modoCompactoAtual();
  const { system, user } = compacto
    ? montarPromptCompacto({
        historico: args.historico,
        ultimasMensagens: args.ultimasMensagens,
        contextoCliente: args.contextoCliente,
        notaVendedor: args.notaVendedor,
      })
    : montarPromptOrientador({
        historico: args.historico,
        ultimasMensagens: args.ultimasMensagens,
        contextoCliente: args.contextoCliente,
        contextoAcademia: args.contextoAcademia,
        resumoEtapas: resumoDasEtapas(),
        regras,
        estilo: args.estilo,
        licoes: args.licoes,
        notaVendedor: args.notaVendedor,
      });

  try {
    // `apertado` impede os +4.000 tokens de reserva do raciocínio, que eram o
    // maior desperdício do pedido no limite por minuto.
    const raw = compacto
      ? await llmTexto(system, user, { maxTokens: 1400, json: true, apertado: true })
      : await llmTexto(system, user, { maxTokens: 2400, json: true, raciocinio: true });
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
    const soTextos = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, 8) : []);
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
      combinados: soTextos(parsed.combinados),
      pendencias: soTextos(parsed.pendencias),
      coaching: comVisitaMarcada(normalizarCoaching(parsed), normalizarFatos(parsed.fatos)),
      alertas,
      conversaEncerrada: parsed.conversaEncerrada === true,
      fatos: normalizarFatos(parsed.fatos),
      pedidos: normalizarPedidos(parsed.pedidos),
    };
  } catch (e) {
    console.error("[orientador] falha na análise:", e);
    throw e;
  }
}

// ── Contato "Não é cliente": só o resumo ─────────────────────────────────────
//
// "Para os contatos que eu selecionar que não é cliente, o orientador deixará
// apenas um resumo do contexto de toda conversa." Ver orientador-resumo.ts
// para o porquê; aqui fica só a parte que fala com o banco e com a IA.

/** Status e nome do cadastro. null quando o cliente sumiu no meio do caminho. */
async function cadastroDoCliente(clienteId: string): Promise<{ status: string | null; nome: string } | null> {
  return db.cliente.findUnique({ where: { id: clienteId }, select: { status: true, nome: true } }).catch(() => null);
}

/**
 * Resumo da conversa inteira, em texto puro. Chamada curta de propósito: não
 * há coaching para gerar, então não se paga por ele.
 */
export async function gerarResumoContato(args: { nomeContato: string; historico: string }): Promise<string> {
  const { system, user } = montarPromptResumoContato(args);
  const bruto = await llmTexto(system, user, { maxTokens: 500 });
  return limparResumo(bruto);
}

/**
 * Roda e grava o caminho do não-cliente. Devolve false quando a IA falhou —
 * aí o chamador decide o que dizer na tela.
 *
 * Além de gravar o resumo, APAGA o rastro de venda que esse contato possa ter
 * deixado enquanto ainda era tratado como negociação: o alerta do Orientador e
 * a espera por resposta. Sem isso ele continuaria cobrando retorno de alguém
 * que o vendedor já disse que não é cliente.
 */
async function resumirContatoNaoCliente(args: {
  clienteId: string; nomeContato: string; historico: string;
}): Promise<boolean> {
  const resumo = await gerarResumoContato({ nomeContato: args.nomeContato, historico: args.historico });
  const { alertas, conversaEncerrada, coaching, fatos, pedidos, ...campos } = analiseSoResumo(resumo);
  void alertas; void conversaEncerrada; void fatos; void pedidos;
  const coachingJson = coaching as unknown as Prisma.InputJsonValue;
  await db.orientadorAnalise.upsert({
    where: { clienteId: args.clienteId },
    create: { clienteId: args.clienteId, ...campos, coaching: coachingJson, melhorResposta: null, pedidosPendentes: null },
    update: { ...campos, coaching: coachingJson, melhorResposta: null, pedidosPendentes: null },
  });
  await atualizarAlertaOrientador(args.clienteId, []).catch(() => {});
  await db.cliente.updateMany({ where: { id: args.clienteId, aguardandoResposta: true }, data: { aguardandoResposta: false } }).catch(() => {});
  return !!resumo;
}

/**
 * Passa o resumo pela conferência contra a conversa antes de gravar.
 *
 * "Esse resumo tá péssimo, o cliente não enviou os documentos." Prompt é
 * pedido; isto é trava. Ver resumo-checagem.ts.
 */
function conferirResumo(resumo: string, midia: MidiaDaConversa, clienteId: string): string {
  const derrubadas = frasesDerrubadas(resumo, midia);
  if (derrubadas.length) {
    console.warn("[orientador] resumo com frase sem apoio na conversa, de", clienteId, derrubadas);
  }
  return corrigirTermos(resumoConferido(resumo, midia));
}

/**
 * Passa o texto que vai à tela pelo vocabulário da casa ("excavadora" →
 * "escavadeira" e afins — ver termos-pt.ts) e confere o resumo contra a
 * conversa. Um lugar só, para nenhum campo escapar.
 */
function limparAnalise(a: AnaliseOrientador, midia: MidiaDaConversa, clienteId: string): AnaliseOrientador {
  const c = a.coaching;
  return {
    ...a,
    resumoNegociacao: conferirResumo(a.resumoNegociacao, midia, clienteId),
    probabilidadeExplicacao: corrigirTermos(a.probabilidadeExplicacao),
    proximaAcao: corrigirTermos(a.proximaAcao),
    oportunidadesPerdidas: corrigirTermosNaLista(a.oportunidadesPerdidas),
    combinados: corrigirTermosNaLista(a.combinados),
    pendencias: corrigirTermosNaLista(a.pendencias),
    alertas: corrigirTermosNaLista(a.alertas),
    coaching: {
      ...c,
      personalidade: {
        ...c.personalidade,
        descricao: corrigirTermos(c.personalidade.descricao),
        comoFalar: corrigirTermosNaLista(c.personalidade.comoFalar),
        evitar: corrigirTermosNaLista(c.personalidade.evitar),
      },
      alertaAgora: c.alertaAgora
        ? { ...c.alertaAgora, titulo: corrigirTermos(c.alertaAgora.titulo), motivo: corrigirTermos(c.alertaAgora.motivo) }
        : null,
      conducao: {
        ...c.conducao,
        acertos: corrigirTermosNaLista(c.conducao.acertos),
        correcoes: corrigirTermosNaLista(c.conducao.correcoes),
      },
      perguntasAgora: corrigirTermosNaLista(c.perguntasAgora),
      informacoesFaltando: corrigirTermosNaLista(c.informacoesFaltando),
      sinaisCompra: corrigirTermosNaLista(c.sinaisCompra),
      sinaisRisco: corrigirTermosNaLista(c.sinaisRisco),
      roteiro: c.roteiro.map((e) => ({ ...e, etapa: corrigirTermos(e.etapa), dica: corrigirTermos(e.dica) })),
      tratamentoObjecoes: c.tratamentoObjecoes.map((o) => ({ ...o, comoTratar: corrigirTermos(o.comoTratar) })),
    },
  };
}

// UM só alerta "orientador" por cliente (nunca um por mensagem/análise): se já
// existe um não resolvido, atualiza o texto; senão cria. Some sozinho quando a
// IA deixa de achar que há algo pedindo atenção agora (mensagens vazio).
// O índice único parcial Alerta(clienteId,tipo) WHERE resolvido=false (ver
// migrations.ts) é quem garante isso de verdade: duas chamadas concorrentes
// (webhook + fallback do cron, por exemplo) podem passar pelo SELECT antes de
// qualquer uma criar a linha — sem o índice, as duas conseguiriam criar,
// duplicando o alerta do mesmo cliente. Com o índice, a segunda tentativa de
// criar falha (P2002) e cai no fallback de update abaixo.
async function atualizarAlertaOrientador(clienteId: string, mensagens: string[]) {
  const mensagem = mensagens.filter((m) => m.trim()).join(" · ");
  if (!mensagem) {
    await db.alerta.updateMany({ where: { clienteId, tipo: "orientador", resolvido: false }, data: { resolvido: true } });
    return;
  }
  const existente = await db.alerta.findFirst({ where: { clienteId, tipo: "orientador", resolvido: false } });
  if (existente) {
    if (existente.mensagem !== mensagem) await db.alerta.update({ where: { id: existente.id }, data: { mensagem } });
    return;
  }
  try {
    await db.alerta.create({ data: { clienteId, tipo: "orientador", mensagem, severidade: "media" } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      await db.alerta.updateMany({ where: { clienteId, tipo: "orientador", resolvido: false }, data: { mensagem } });
    } else {
      throw e;
    }
  }
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

  // Contato marcado como "Não é cliente": só o resumo da conversa, nada de
  // coaching nem de melhor resposta. Sai antes de tudo — inclusive antes de
  // gastar a chamada grande da análise.
  const cadastro = await cadastroDoCliente(args.conv.clienteId);
  if (soResumo(cadastro?.status)) {
    await resumirContatoNaoCliente({
      clienteId: args.conv.clienteId,
      nomeContato: cadastro?.nome ?? args.conv.externalPhone,
      historico: recortarHistorico(args.historicoCompleto, janelaHistoricoAtual(JANELA_HISTORICO)),
    }).catch((e) => zeusReport(e, "resumo de contato que não é cliente"));
    return { respondido: false };
  }

  // 1) Análise completa (painel + coaching). Nada é enviado sozinho, então a
  // resposta pode esperar a análise e aproveitar as orientações dela.
  const aprendizado = await lerAprendizadoOrientador().catch(() => null);
  // A nota do vendedor vale também na análise automática, não só no
  // "Reanalisar" — senão a próxima mensagem do cliente apagaria o que ele
  // escreveu.
  const notaVendedor = await lerNotaVendedor(args.conv.clienteId);
  let analise: AnaliseOrientador;
  try {
    analise = await gerarAnaliseOrientador({
      historico: recortarHistorico(args.historicoCompleto, janelaHistoricoAtual(JANELA_HISTORICO)),
      ultimasMensagens: args.ultimasMensagens,
      contextoCliente: args.contextoCliente,
      contextoAcademia: args.contextoAcademia,
      estilo: args.estilo,
      licoes: aprendizado?.licoes,
      notaVendedor,
    });
  } catch (e) {
    await zeusReport(e, "gerarAnaliseOrientador (Orientador de Vendas)");
    return { respondido: false };
  }

  // 2) Melhor resposta, orientada pelo coaching (alerta, perfil, perguntas).
  const reply = await gerarRespostaRapida({
    historico: recortarHistorico(args.historicoCompleto, janelaHistoricoAtual(JANELA_HISTORICO)),
    ultimasMensagens: args.ultimasMensagens,
    contextoCliente: args.contextoCliente,
    estilo: args.estilo,
    dicas: dicasParaResposta(analise.coaching, analise.proximaAcao),
  });
  // A melhor resposta fica no painel e aparece na conversa quando o vendedor
  // pede; "respondido" = mensagem tratada (não precisa do fallback).
  const respondido = !!reply;

  // A conferência do resumo precisa saber o que foi REALMENTE anexado na
  // conversa e de que lado (ver resumo-checagem.ts). Só direção e tipo — é
  // uma consulta curta.
  const anexos = await db.whatsAppMessage.findMany({
    where: { conversationId: args.conv.id, isDraft: false, mediaType: { not: null } },
    select: { direction: true, body: true, mediaType: true, sentAt: true },
  }).catch(() => []);
  const midia = midiaDaConversa(anexos);

  // "fatos" NÃO é coluna de OrientadorAnalise: sai do spread e vai para a
  // ficha da negociação logo abaixo. Deixá-lo aqui derrubaria o upsert inteiro.
  const { alertas, conversaEncerrada, coaching, fatos, pedidos, ...campos } = limparAnalise(analise, midia, args.conv.clienteId);
  const coachingJson = coaching as unknown as Prisma.InputJsonValue;
  await db.orientadorAnalise.upsert({
    where: { clienteId: args.conv.clienteId },
    create: { clienteId: args.conv.clienteId, ...campos, coaching: coachingJson, melhorResposta: reply || null, pedidosPendentes: guardarPedidos(pedidos) },
    update: { ...campos, coaching: coachingJson, melhorResposta: reply || undefined, pedidosPendentes: guardarPedidos(pedidos) },
  });

  await aplicarFatos(args.conv.clienteId, fatos, !!notaVendedor);
  await atualizarAlertaOrientador(args.conv.clienteId, alertas).catch(() => {});
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
    db.whatsAppMessage.findMany({ where: { conversationId, isDraft: false }, orderBy: { sentAt: "desc" }, take: MAX_MENSAGENS }),
    db.estiloDeFala.findFirst().catch(() => null),
  ]);
  if (msgs.length === 0) return { ok: false, erro: "Conversa sem mensagens." };
  msgs.reverse();
  // A conversa é escrita com autor e anexo explícitos — ver historico-linha.ts
  // para o defeito que isso corrige ("Cliente enviou documentos" sem nenhum
  // documento na conversa).
  const historico = montarHistorico(msgs);
  const ultimas = montarUltimas(msgs);
  const midia = midiaDaConversa(msgs);
  // Contato "Não é cliente": o Reanalisar refaz o resumo e para por aí.
  const cadastro = await cadastroDoCliente(conv.clienteId);
  if (soResumo(cadastro?.status)) {
    try {
      const fez = await resumirContatoNaoCliente({
        clienteId: conv.clienteId,
        nomeContato: cadastro?.nome ?? conv.contactName ?? conv.externalPhone,
        historico: recortarHistorico(historico, janelaHistoricoAtual(JANELA_HISTORICO)),
      });
      await consumirOrcamentoIA();
      return fez ? { ok: true } : { ok: false, erro: "A IA não devolveu o resumo. Tente de novo." };
    } catch (e) {
      return { ok: false, erro: mensagemErroIA(e) };
    }
  }

  const contextoCliente = await montarContextoCliente({ id: conv.id, contactName: conv.contactName, clienteId: conv.clienteId, externalPhone: conv.externalPhone });
  const contextoAcademia = montarContextoAcademia(historico);
  const aprendizado = await lerAprendizadoOrientador().catch(() => null);
  // A nota que o vendedor escreveu na tela entra na análise.
  const notaVendedor = await lerNotaVendedor(conv.clienteId);
  try {
    const ultimaDoCliente = msgs[msgs.length - 1].direction === "IN";
    const analise = await gerarAnaliseOrientador({ historico: recortarHistorico(historico, janelaHistoricoAtual(JANELA_HISTORICO)), ultimasMensagens: ultimas, contextoCliente, contextoAcademia, estilo: estilo?.guia ?? null, licoes: aprendizado?.licoes, notaVendedor });
    const resposta = ultimaDoCliente
      ? await gerarRespostaRapida({ historico: recortarHistorico(historico, janelaHistoricoAtual(JANELA_HISTORICO)), ultimasMensagens: ultimas, contextoCliente, estilo: estilo?.guia ?? null, dicas: dicasParaResposta(analise.coaching, analise.proximaAcao) })
      : "";
    await consumirOrcamentoIA();
    // "fatos" não é coluna de OrientadorAnalise (ver processarOrientador).
    const { alertas, conversaEncerrada, coaching, fatos, pedidos, ...campos } = limparAnalise(analise, midia, conv.clienteId);
    const coachingJson = coaching as unknown as Prisma.InputJsonValue;
    await db.orientadorAnalise.upsert({
      where: { clienteId: conv.clienteId },
      create: { clienteId: conv.clienteId, ...campos, coaching: coachingJson, melhorResposta: resposta || null, pedidosPendentes: guardarPedidos(pedidos) },
      update: { ...campos, coaching: coachingJson, ...(resposta ? { melhorResposta: resposta } : {}), pedidosPendentes: guardarPedidos(pedidos) },
    });
    await aplicarFatos(conv.clienteId, fatos, !!notaVendedor);
    await atualizarAlertaOrientador(conv.clienteId, alertas).catch(() => {});
    await aplicarConversaEncerrada(conv.clienteId, conversaEncerrada);
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: mensagemErroIA(e) };
  }
}
