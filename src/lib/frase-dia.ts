// Frase do dia do Dashboard: um texto motivacional curto + uma citação,
// gerados pela IA UMA vez por dia (fuso de Brasília) e guardados em
// Configuracao. Sem IA (ou se ela repetir), cai numa lista fixa, que passa
// pela mesma conferência.
//
// A regra de "o que conta como repetido" e o tema de cada dia moram em
// lib/frase-dia-regra.ts (puro, testado). Ver lá o defeito que ela resolve:
// a mesma mensagem voltando em dias diferentes.

import { db } from "@/lib/db";
import { llmTexto, iaHabilitada } from "@/lib/ai";
import { lerParametros } from "@/lib/parametros";
import {
  temaDoDia, lerHistorico, motivoDeRecusa, registroDe, escolherDaReserva, aberturaDoTexto,
  DIAS_SEM_REPETIR_AUTOR, DIAS_SEM_REPETIR_ABERTURA, type Registro, type Candidata,
} from "@/lib/frase-dia-regra";

export type FraseDoDia = { data: string; texto: string; frase: string; autor: string };

const CHAVE_ATUAL = "frase_dia.atual";
const CHAVE_HISTORICO = "frase_dia.historico";
const MAX_HISTORICO = 400;

const RESERVA: { texto: string; frase: string; autor: string }[] = [
  { texto: "Cada visita que você faz hoje é uma semente. Nem toda germina na hora, mas o vendedor que planta todo dia é o que colhe o ano inteiro.", frase: "O sucesso é a soma de pequenos esforços repetidos dia após dia.", autor: "Robert Collier" },
  { texto: "O cliente não compra a máquina, compra a certeza de que a obra vai andar. Venda tranquilidade e o pedido vem junto.", frase: "As pessoas não compram o que você faz, compram o porquê você faz.", autor: "Simon Sinek" },
  { texto: "Um 'não' hoje é só informação: o momento não era o certo. Anote, marque o retorno e siga. A persistência educada fecha mais negócio que qualquer desconto.", frase: "Cada 'não' me aproxima do próximo 'sim'.", autor: "Mentalidade de campeão" },
  { texto: "Antes de falar de preço, entenda o problema. Quem escuta primeiro vende melhor, porque oferece a solução certa e não a máquina que estava na cabeça.", frase: "Se você não conhece o problema, não venda a solução.", autor: "Sabedoria de vendas" },
  { texto: "Disciplina é fazer as ligações do dia mesmo quando ninguém está olhando. É isso que separa o vendedor de resultado do vendedor de sorte.", frase: "Não espere pela oportunidade perfeita. Crie-a.", autor: "George Bernard Shaw" },
  { texto: "Cada cliente antigo é uma porta para três novos. Peça indicação, cuide do pós-venda e a sua carteira cresce sozinha.", frase: "A melhor propaganda é um cliente satisfeito.", autor: "Philip Kotler" },
  { texto: "Você não precisa vender hoje. Precisa avançar um passo com cada cliente: uma visita marcada, uma proposta enviada, uma dúvida tirada. Passos viram vendas.", frase: "A jornada de mil milhas começa com um único passo.", autor: "Lao-Tsé" },
  { texto: "Confiança se constrói na hora em que você cumpre o que prometeu — o retorno na hora combinada, a informação correta, o prazo real. É o seu maior diferencial.", frase: "Faça o que você diz que vai fazer.", autor: "Regra de ouro do vendedor" },
  { texto: "O concorrente pode ter preço. Você tem presença: está no campo, conhece a obra, sabe o nome do operador. Isso não se compra com desconto.", frase: "Excelência é fazer o comum de forma incomum.", autor: "Booker T. Washington" },
  { texto: "Toda manhã é uma nova página do mês. Não importa o resultado de ontem — a meta é bater hoje o que só depende de você: contato, visita e proposta.", frase: "O segredo de ir em frente é começar.", autor: "Mark Twain" },
  { texto: "Quem estuda a máquina vende com autoridade. Dez minutos por dia na ficha técnica valem mais que uma hora de conversa fiada na frente do cliente.", frase: "Conhecimento é poder.", autor: "Francis Bacon" },
  { texto: "Não subestime a mensagem simples de acompanhamento. Um 'como está a obra?' sincero reabre negociação que parecia morta.", frase: "A persistência é o caminho do êxito.", autor: "Charles Chaplin" },
  { texto: "O melhor momento para prospectar é quando a carteira está cheia — porque assim ela nunca esvazia. Ligue para dois clientes novos hoje.", frase: "Cave o poço antes de ter sede.", autor: "Provérbio chinês" },
  { texto: "Objeção não é rejeição; é o cliente pedindo mais motivo para dizer sim. Agradeça a objeção e responda com fato, não com pressão.", frase: "A resposta está na pergunta certa.", autor: "Sabedoria de vendas" },
  { texto: "Grandes negociações são fechadas por quem mantém a calma quando o cliente esfria. Respire, dê espaço e volte com valor novo.", frase: "Paciência é amarga, mas seu fruto é doce.", autor: "Jean-Jacques Rousseau" },
  { texto: "Você é a marca na frente do cliente. Cada aperto de mão, cada resposta rápida no WhatsApp, cada visita pontual constrói a reputação que fecha a próxima venda.", frase: "Sua reputação chega antes de você.", autor: "Ditado popular" },
  { texto: "Metas grandes assustam quando olhadas de longe. Divida em semanas: quantas visitas, quantas propostas. O resto é consequência.", frase: "Um objetivo sem plano é apenas um desejo.", autor: "Antoine de Saint-Exupéry" },
  { texto: "Venda consultiva é ajudar o cliente a decidir bem — mesmo quando a decisão certa demora. Quem ajuda de verdade é lembrado na hora da compra.", frase: "Venda não é persuasão — é ajudar alguém a tomar a decisão certa.", autor: "Brian Tracy" },
  { texto: "Energia é contagiosa. Entre na obra com entusiasmo pelo trabalho do cliente e ele vai querer ter você por perto.", frase: "O entusiasmo é a mãe do esforço.", autor: "Ralph Waldo Emerson" },
  { texto: "Cada máquina entregue é o começo de um relacionamento, não o fim de uma venda. O pós-venda de hoje é o faturamento do ano que vem.", frase: "Cuide dos clientes que você tem e eles cuidarão do seu futuro.", autor: "Sabedoria de vendas" },
  { texto: "Não deixe o telefone decidir o seu dia. Faça primeiro as três ações mais importantes e só depois responda o resto.", frase: "O que é importante raramente é urgente.", autor: "Dwight Eisenhower" },
  { texto: "Quem registra tudo no CRM nunca perde o fio da negociação — e o cliente sente quando você lembra dos detalhes.", frase: "A memória é curta; o registro é longo.", autor: "Regra do vendedor" },
  { texto: "Diferença entre bom e excelente é o 'a mais': uma ligação a mais, uma visita a mais, uma proposta revisada com mais cuidado.", frase: "A diferença entre ordinário e extraordinário é aquele pequeno 'extra'.", autor: "Jimmy Johnson" },
  { texto: "A obra do seu cliente não para no fim de semana, e o problema dele também não. Estar disponível na hora certa é o que faz a diferença.", frase: "Oportunidades não acontecem, você as cria.", autor: "Chris Grosser" },
  { texto: "Fale menos de especificação e mais de resultado: horas de trabalho, consumo em reais por mês, entrega da obra no prazo. É isso que o cliente compra.", frase: "Simplicidade é o último grau de sofisticação.", autor: "Leonardo da Vinci" },
  { texto: "Seu melhor cliente de amanhã pode estar numa cidade onde você nunca fez visita. Abra o mapa, escolha uma região e vá.", frase: "Quem não arrisca, não petisca.", autor: "Ditado popular" },
  { texto: "Não venda para ganhar comissão; venda para resolver o problema e a comissão vira consequência natural.", frase: "Sirva primeiro, venda depois.", autor: "Sabedoria de vendas" },
  { texto: "Cada conversa é uma chance de aprender como o cliente pensa. Anote o que funcionou, repita amanhã com mais precisão.", frase: "Aprender é a única coisa que a mente nunca cansa, nunca teme e nunca se arrepende.", autor: "Leonardo da Vinci" },
  { texto: "A rotina vence o talento quando o talento não tem rotina. Bloco de visitas, bloco de ligações, bloco de propostas — todo dia.", frase: "Somos o que repetidamente fazemos.", autor: "Aristóteles (atrib.)" },
  { texto: "Confiança no produto se transmite. Você vende New Holland e Dynapac: máquinas que trabalham. Fale disso com a convicção de quem já viu na obra.", frase: "Acredite que você pode e já estará no meio do caminho.", autor: "Theodore Roosevelt" },
];

function hojeBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function lerConfig(chave: string): Promise<string | null> {
  const c = await db.configuracao.findUnique({ where: { chave } }).catch(() => null);
  return c?.valor ?? null;
}

async function gravarConfig(chave: string, valor: string): Promise<void> {
  await db.configuracao.upsert({ where: { chave }, update: { valor }, create: { chave, valor } }).catch(() => {});
}

// Uma chamada à IA. O pedido leva o TEMA do dia (é o que faz o texto variar
// de verdade) e o que não pode voltar: as citações já usadas, os autores e as
// aberturas recentes. "recusa" é o motivo da tentativa anterior, quando houve.
async function pedirAIA(hoje: string, historico: Registro[], recusa: string | null): Promise<Candidata | null> {
  const param = await lerParametros();
  const citacoes = historico.slice(-120).map((h) => `"${h.f}"`).join(", ") || "(nenhuma ainda)";
  const autores = [...new Set(historico.slice(-DIAS_SEM_REPETIR_AUTOR).map((h) => h.a).filter(Boolean))].join(", ") || "(nenhum)";
  const aberturas = [...new Set(historico.slice(-DIAS_SEM_REPETIR_ABERTURA).map((h) => h.t).filter(Boolean))].map((t) => `"${t}…"`).join(", ") || "(nenhuma)";
  const raw = await llmTexto(
    `Você escreve a "Frase do dia" do painel de um vendedor de máquinas pesadas (${param.marcas}) no ${param.regiao}.
Devolva SOMENTE um JSON válido com as chaves:
{ "texto": string, "frase": string, "autor": string }
- "texto": 2 a 3 frases motivacionais, em português do Brasil, tom direto e humano, SOBRE O TEMA DE HOJE: ${temaDoDia(hoje)}. Concreto, do dia a dia dele. Sem emojis.
- "frase": uma citação curta e inspiradora (máx. 20 palavras) que combine com o tema. Pode ser de autor real e conhecido, com atribuição correta; se não tiver certeza da autoria, use "Sabedoria de vendas".
- "autor": nome do autor.
PROIBIDO repetir, nem com outras palavras:
- estas citações já usadas: ${citacoes};
- estes autores (usados nas últimas semanas): ${autores};
- começar o texto como estes (últimos dias): ${aberturas}.${recusa ? `\nA tentativa anterior foi recusada porque ${recusa}. Escolha outra citação e outro começo.` : ""}`,
    `Gere a frase do dia de ${hoje}.`,
    { maxTokens: 350, json: true }
  );
  const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const p = JSON.parse(json) as { texto?: string; frase?: string; autor?: string };
  if (!p.texto || !p.frase) return null;
  return {
    texto: p.texto.trim(),
    frase: p.frase.trim().replace(/^["“]|["”]$/g, ""),
    autor: (p.autor ?? "").trim() || "Sabedoria de vendas",
  };
}

/**
 * A IA escreve; a regra confere. Repetiu, ela tenta UMA vez mais sabendo o
 * motivo — duas chamadas no máximo, porque a cota grátis de IA é curta e o
 * Orientador precisa dela o dia todo. Repetiu de novo, entra a reserva.
 */
async function gerarComIA(hoje: string, historico: Registro[]): Promise<Candidata | null> {
  if (!iaHabilitada()) return null;
  let recusa: string | null = null;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const c = await pedirAIA(hoje, historico, recusa);
      if (!c) return null;
      recusa = motivoDeRecusa(c, historico);
      if (!recusa) return c;
      console.warn(`[frase-dia] IA repetiu (tentativa ${tentativa + 1}): ${recusa}`);
    } catch (e) {
      console.error("[frase-dia] IA falhou:", e instanceof Error ? e.message : e);
      return null;
    }
  }
  return null;
}

export async function obterFraseDoDia(): Promise<FraseDoDia> {
  const hoje = hojeBrasilia();
  const atualRaw = await lerConfig(CHAVE_ATUAL);
  if (atualRaw) {
    try {
      const atual = JSON.parse(atualRaw) as FraseDoDia;
      if (atual.data === hoje && atual.texto && atual.frase) return atual;
    } catch {}
  }

  let historico: Registro[] = [];
  try { historico = lerHistorico(JSON.parse((await lerConfig(CHAVE_HISTORICO)) ?? "[]")); } catch { historico = []; }
  // A de ontem completa o registro dela no histórico: o formato antigo
  // guardava só a citação, e é a abertura e o autor de ontem que não podem
  // voltar hoje.
  if (atualRaw) {
    try {
      const ontem = JSON.parse(atualRaw) as FraseDoDia;
      const ultimo = historico[historico.length - 1];
      const completo: Registro = { d: ontem.data, f: ontem.frase, a: ontem.autor, t: aberturaDoTexto(ontem.texto ?? "") };
      if (ontem.frase && (!ultimo || ultimo.f !== ontem.frase)) historico.push(completo);
      else if (ultimo && ultimo.f === ontem.frase && !ultimo.t) historico[historico.length - 1] = completo;
    } catch {}
  }

  const escolhida = (await gerarComIA(hoje, historico)) ?? escolherDaReserva(RESERVA, historico);
  const nova: FraseDoDia = { data: hoje, ...escolhida };
  await gravarConfig(CHAVE_ATUAL, JSON.stringify(nova));
  await gravarConfig(CHAVE_HISTORICO, JSON.stringify([...historico, registroDe(escolhida, hoje)].slice(-MAX_HISTORICO)));
  return nova;
}
