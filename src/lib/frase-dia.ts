// Frase do dia do Dashboard: um texto motivacional curto + uma citação,
// gerados pela IA UMA vez por dia (fuso de Brasília) e guardados em
// Configuracao. Um histórico das citações já usadas é enviado à IA para
// nunca repetir; sem IA (ou se falhar), cai numa lista fixa grande, também
// respeitando o histórico.

import { db } from "@/lib/db";
import { llmTexto, iaHabilitada } from "@/lib/ai";
import { lerParametros } from "@/lib/parametros";

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

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

async function gerarComIA(usadas: string[]): Promise<{ texto: string; frase: string; autor: string } | null> {
  const param = await lerParametros();
  if (!iaHabilitada()) return null;
  try {
    const raw = await llmTexto(
      `Você escreve a "Frase do dia" do painel de um vendedor de máquinas pesadas (${param.marcas}) no ${param.regiao}.
Devolva SOMENTE um JSON válido com as chaves:
{ "texto": string, "frase": string, "autor": string }
- "texto": 2 a 3 frases motivacionais, em português do Brasil, tom direto e humano, ligadas ao dia a dia de vendas (visitas, propostas, obra, cliente, persistência). Sem emojis.
- "frase": uma citação curta e inspiradora (máx. 20 palavras). Pode ser de autor real e conhecido, com atribuição correta; se não tiver certeza da autoria, use "Sabedoria de vendas".
- "autor": nome do autor.
NUNCA repita nenhuma destas citações já usadas: ${usadas.slice(-120).map((u) => `"${u}"`).join(", ") || "(nenhuma ainda)"}.`,
      `Gere a frase do dia de ${hojeBrasilia()}.`,
      { maxTokens: 350, json: true }
    );
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const p = JSON.parse(json) as { texto?: string; frase?: string; autor?: string };
    if (!p.texto || !p.frase) return null;
    const frase = p.frase.trim().replace(/^["“]|["”]$/g, "");
    if (usadas.some((u) => normalizar(u) === normalizar(frase))) return null;
    return { texto: p.texto.trim(), frase, autor: (p.autor ?? "").trim() || "Sabedoria de vendas" };
  } catch (e) {
    console.error("[frase-dia] IA falhou:", e instanceof Error ? e.message : e);
    return null;
  }
}

function daReserva(usadas: string[]): { texto: string; frase: string; autor: string } {
  const usadasNorm = new Set(usadas.map(normalizar));
  const inedita = RESERVA.find((r) => !usadasNorm.has(normalizar(r.frase)));
  if (inedita) return inedita;
  // Todas já usadas: escolhe a usada há mais tempo (nunca repete em sequência).
  const ordem = new Map(usadas.map((u, i) => [normalizar(u), i]));
  return [...RESERVA].sort((a, b) => (ordem.get(normalizar(a.frase)) ?? -1) - (ordem.get(normalizar(b.frase)) ?? -1))[0];
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

  let usadas: string[] = [];
  try { usadas = JSON.parse((await lerConfig(CHAVE_HISTORICO)) ?? "[]"); } catch { usadas = []; }

  const escolhida = (await gerarComIA(usadas)) ?? daReserva(usadas);
  const nova: FraseDoDia = { data: hoje, ...escolhida };
  await gravarConfig(CHAVE_ATUAL, JSON.stringify(nova));
  await gravarConfig(CHAVE_HISTORICO, JSON.stringify([...usadas, escolhida.frase].slice(-MAX_HISTORICO)));
  return nova;
}
