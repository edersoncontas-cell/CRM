// A REGRA da Motivação do dia — sem banco e sem IA, para poder ser testada.
//
// O defeito que ela resolve (relatado pelo vendedor em 24/09/2026): "a mesma
// mensagem várias vezes em dias diferentes". Três causas, todas no desenho
// antigo de lib/frase-dia.ts:
//
//   1. Só a CITAÇÃO era conferida contra repetição, e por igualdade exata.
//      A IA devolve a mesma citação famosa com palavras um pouco diferentes
//      ("A excelência não é um ato, é um hábito" / "… é um hábito constante")
//      e a comparação exata deixava as duas passarem como inéditas.
//   2. O TEXTO de cima não era guardado nem conferido — e, com o mesmo pedido
//      todo dia, a IA escrevia sempre sobre o mesmo assunto ("Cada visita…").
//   3. O pedido era idêntico todo dia; só a data mudava.
//
// Aqui: um TEMA por dia (o texto varia por construção, não por sorte), e a
// repetição medida por PARECENÇA — citação, abertura do texto e autor.

/** Um assunto por dia. 31 itens: dois dias seguidos nunca caem no mesmo. */
export const TEMAS_DO_DIA: readonly string[] = [
  "prospectar cliente novo numa cidade onde ainda não há venda",
  "pós-venda: voltar a quem já comprou e pedir indicação",
  "responder à objeção de preço com custo por hora, e não com desconto",
  "preparar a visita técnica: estudar a obra antes de ir",
  "proposta bem feita: clara, com prazo, condição e a conta de retorno",
  "o retorno combinado: ligar no dia e na hora prometidos",
  "escutar mais do que falar: descobrir o problema antes de oferecer a máquina",
  "conhecer a ficha técnica a fundo para falar com autoridade",
  "planejar a semana: quantas visitas, ligações e propostas",
  "crédito e financiamento: ajudar o cliente a viabilizar a compra",
  "concorrência: vender valor e suporte, não só a máquina",
  "economia de diesel e custo de operação como argumento de venda",
  "relacionamento com o operador e o encarregado da obra",
  "feiras e eventos: transformar contato em visita marcada",
  "licitações de prefeitura: acompanhar editais com antecedência",
  "reaquecer a negociação que esfriou sem parecer insistente",
  "fechar o negócio: pedir a decisão com segurança",
  "prazo de entrega: prometer só o que dá para cumprir",
  "persistência educada depois de um 'não'",
  "pontualidade e palavra cumprida como diferencial",
  "estudar um pouco todo dia: técnica de venda e produto",
  "a meta da semana: o que só depende de você hoje",
  "registrar tudo no CRM para nunca perder o fio da conversa",
  "roteiro de visitas: aproveitar a viagem para ver mais de um cliente",
  "responder rápido no WhatsApp sem perder a qualidade",
  "máquina usada na troca: abrir a conversa pela necessidade do cliente",
  "o ritmo do agro capixaba: café, safra e a hora certa de oferecer",
  "obra pública e construtora: entender quem decide a compra",
  "aprender com a venda perdida: o motivo ensina mais que o fechamento",
  "energia e ânimo no começo do dia para puxar o resto",
  "trabalhar junto com a oficina e as peças para o cliente ficar",
];

/** Data no formato AAAA-MM-DD → dia do ano (1 a 366). */
function diaDoAno(dataISO: string): number {
  const [a, m, d] = dataISO.split("-").map(Number);
  const inicio = Date.UTC(a, 0, 1);
  return Math.floor((Date.UTC(a, (m || 1) - 1, d || 1) - inicio) / 86_400_000) + 1;
}

/** O tema daquele dia. Mesmo dia, mesmo tema; dia seguinte, o próximo. */
export function temaDoDia(dataISO: string): string {
  return TEMAS_DO_DIA[(diaDoAno(dataISO) - 1) % TEMAS_DO_DIA.length];
}

// ---------------------------------------------------------------------------
// Parecença
// ---------------------------------------------------------------------------

const PALAVRAS_VAZIAS = new Set([
  "para", "como", "mais", "mas", "que", "uma", "um", "com", "sem", "por", "pela", "pelo", "nos", "nas", "dos", "das",
  "isso", "esse", "essa", "este", "esta", "todo", "toda", "cada", "quem", "voce", "seu", "sua", "seus", "suas",
  "nao", "sim", "sempre", "nunca", "hoje", "muito", "pode", "sera", "portanto", "entao", "onde", "quando",
  "sobre", "entre", "depois", "antes", "ainda", "tambem", "apenas", "mesmo", "outro", "outra", "tudo", "nada",
]);

export function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** As palavras que carregam sentido (4+ letras, fora as vazias). */
export function palavrasFortes(s: string): Set<string> {
  return new Set(normalizar(s).split(" ").filter((p) => p.length >= 4 && !PALAVRAS_VAZIAS.has(p)));
}

/**
 * Duas frases dizem a mesma coisa? Mede quanto da MENOR está dentro da maior
 * (e não a média das duas): "A excelência não é um ato, é um hábito" está
 * inteira dentro de "Somos o que repetidamente fazemos. A excelência, portanto,
 * não é um ato, mas um hábito" — é a mesma citação, e a média diria que não.
 * Pede pelo menos 2 palavras em comum para frases curtas não colidirem por acaso.
 */
export function parecidas(a: string, b: string, limite = 0.6): boolean {
  const na = normalizar(a), nb = normalizar(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const A = palavrasFortes(a), B = palavrasFortes(b);
  if (!A.size || !B.size) return false;
  let comuns = 0;
  for (const p of A) if (B.has(p)) comuns += 1;
  return comuns >= 2 && comuns / Math.min(A.size, B.size) >= limite;
}

/** As duas primeiras palavras fortes do texto — o "Cada visita…" que se repetia. */
export function aberturaDoTexto(texto: string): string {
  return normalizar(texto).split(" ").filter((p) => p.length >= 4).slice(0, 2).join(" ");
}

// ---------------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------------

/**
 * Uma entrada do histórico. d = data, f = citação, a = autor, t = abertura do
 * texto. O histórico antigo guardava só a citação (string) — continua lido.
 */
export type Registro = { d?: string; f: string; a?: string; t?: string };

export function lerHistorico(bruto: unknown): Registro[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .map((x): Registro | null => {
      if (typeof x === "string") return x.trim() ? { f: x } : null;
      if (x && typeof x === "object" && typeof (x as Registro).f === "string") return x as Registro;
      return null;
    })
    .filter((x): x is Registro => x !== null);
}

export type Candidata = { texto: string; frase: string; autor: string };

/** Autores que não voltam antes de tantos dias — "Aristóteles" toda semana cansa. */
export const DIAS_SEM_REPETIR_AUTOR = 21;
/** A mesma abertura de texto não volta antes de tantos dias. */
export const DIAS_SEM_REPETIR_ABERTURA = 14;

const AUTORES_GENERICOS = new Set(["sabedoria de vendas", "ditado popular", "provérbio", "regra de ouro do vendedor", "regra do vendedor", "mentalidade de campeão"].map(normalizar));

/**
 * Por que esta candidata NÃO serve (texto para mandar de volta à IA), ou null
 * quando está boa. Olha o histórico inteiro para a citação e só os últimos
 * dias para autor e abertura — repetir autor depois de um mês é aceitável.
 */
export function motivoDeRecusa(c: Candidata, historico: Registro[]): string | null {
  const citacaoIgual = historico.find((h) => parecidas(c.frase, h.f));
  if (citacaoIgual) return `a citação "${c.frase}" já foi usada (parecida com "${citacaoIgual.f}")`;

  const autor = normalizar(c.autor);
  if (autor && !AUTORES_GENERICOS.has(autor)) {
    const recentes = historico.slice(-DIAS_SEM_REPETIR_AUTOR);
    if (recentes.some((h) => h.a && normalizar(h.a) === autor)) return `o autor ${c.autor} foi usado nos últimos ${DIAS_SEM_REPETIR_AUTOR} dias`;
  }

  const abertura = aberturaDoTexto(c.texto);
  if (abertura) {
    const recentes = historico.slice(-DIAS_SEM_REPETIR_ABERTURA);
    if (recentes.some((h) => h.t && h.t === abertura)) return `o texto começa igual a um dos últimos ${DIAS_SEM_REPETIR_ABERTURA} dias ("${abertura}…")`;
  }
  return null;
}

/** O que guardar no histórico para a candidata aceita. */
export function registroDe(c: Candidata, dataISO: string): Registro {
  return { d: dataISO, f: c.frase, a: c.autor, t: aberturaDoTexto(c.texto) };
}

/**
 * Da lista de reserva, a primeira que passa na conferência. Se todas já foram
 * usadas (depois de um mês sem IA), a usada há mais tempo — nunca a de ontem.
 */
export function escolherDaReserva(reserva: readonly Candidata[], historico: Registro[]): Candidata {
  const boa = reserva.find((r) => motivoDeRecusa(r, historico) === null);
  if (boa) return boa;
  const posicao = (r: Candidata) => {
    for (let i = historico.length - 1; i >= 0; i--) if (parecidas(r.frase, historico[i].f)) return i;
    return -1;
  };
  return [...reserva].sort((x, y) => posicao(x) - posicao(y))[0];
}
