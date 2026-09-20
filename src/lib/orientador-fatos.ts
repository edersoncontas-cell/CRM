// Os FATOS da negociação lidos pelo Orientador: qual máquina, quanto, como o
// cliente vai pagar e em que cidade ele fica.
//
// Por que este módulo existe (e por que o card "Negociação" vivia vazio):
// o card lê a tabela Negociacao. Quem alimentava essa tabela era
// analisarConversaIA — uma extração que olha SÓ as mensagens do WhatsApp e
// nunca viu o campo "O que o Orientador precisa saber". Então o vendedor
// escrevia "fechamos em 610 mil, financiamento pelo meu banco", a leitura do
// Orientador até melhorava, mas máquina e valor continuavam "ainda não
// definido", porque ninguém gravava aquilo na negociação.
//
// Agora quem extrai os fatos é o próprio Orientador, que lê as duas fontes —
// a conversa e a nota escrita na mão — e esta é a camada que valida o que ele
// devolve antes de encostar no banco. Sem banco e sem rede aqui: dá para
// testar cada regra.

import { NOMES_MUNICIPIOS_ES } from "@/lib/municipios-es";

/** As quatro formas de pagamento de verdade do negócio. */
export const PAGAMENTOS_VALIDOS = ["avista", "financiamento", "consorcio", "crd_pme"] as const;
export type CondicaoPagamento = (typeof PAGAMENTOS_VALIDOS)[number];

export const MARCAS_VALIDAS = ["New Holland", "Dynapac"] as const;

export type FatosNegociacao = {
  marca: string | null;
  maquinaModelo: string | null;
  valor: number | null;
  condicaoPagamento: CondicaoPagamento | null;
  municipio: string | null;
  /**
   * O vendedor já esteve com o cliente presencialmente.
   *
   * Vira dado, e não só texto, porque o roteiro até o fechamento precisa
   * marcar a etapa "Visita" como feita. Contar com a IA lembrar de mexer no
   * roteiro toda vez é frágil; com o booleano, a marcação é garantida.
   * null = a conversa não disse nada a respeito.
   */
  visitaRealizada: boolean | null;
  /** Entrada da negociação, em reais e/ou em percentual do valor. */
  entradaValor: number | null;
  entradaPercentual: number | null;
  /**
   * O que muda a proposta e não cabe nos outros campos: tamanho do braço
   * quando é escavadeira, e se a venda é com Inscrição Estadual (I.E.).
   */
  observacao: string | null;
};

export const FATOS_VAZIOS: FatosNegociacao = {
  marca: null, maquinaModelo: null, valor: null, condicaoPagamento: null, municipio: null,
  visitaRealizada: null, entradaValor: null, entradaPercentual: null, observacao: null,
};

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Palavras que NÃO são forma de pagamento, mesmo vindo no campo de pagamento.
 * "outro" está aqui porque era literalmente o que aparecia na tela: o contrato
 * antigo da IA permitia "outro", isso ia para o banco e o card mostrava
 * "Pagamento: outro" como se fosse informação.
 */
const NAO_E_PAGAMENTO = new Set([
  "outro", "outros", "pesquisa_preco", "pesquisando", "interesse_real", "interesse_futuro",
  "a definir", "indefinido", "nao definido", "n/a", "na", "null", "nenhum", "-", "?",
]);

/** Sinônimos que o vendedor e a IA usam para cada uma das quatro formas. */
const APELIDOS_PAGAMENTO: [RegExp, CondicaoPagamento][] = [
  [/^(avista|a vista|dinheiro|pix|recurso proprio|a ?vista)$/, "avista"],
  [/^(financiamento|financiado|finame|bndes|banco|credito bancario|financ)/, "financiamento"],
  [/^(consorcio|carta de credito|carta contemplada)/, "consorcio"],
  [/^(crd_pme|crd pme|crdpme|parcelado pela casa|parcelamento da casa|boleto da casa|direto com a casa)/, "crd_pme"],
];

/**
 * Normaliza a forma de pagamento para um dos quatro códigos. Devolve null
 * para qualquer coisa que não seja uma delas — "outro" não é resposta.
 */
export function normalizarPagamento(valor: unknown): CondicaoPagamento | null {
  if (typeof valor !== "string") return null;
  const v = semAcento(valor).replace(/\s+/g, " ");
  if (!v || NAO_E_PAGAMENTO.has(v)) return null;
  for (const [re, codigo] of APELIDOS_PAGAMENTO) if (re.test(v)) return codigo;
  return null;
}

// Lista do ES normalizada uma vez só.
const ES_POR_CHAVE = new Map(NOMES_MUNICIPIOS_ES.map((n) => [semAcento(n), n]));

/**
 * Só municípios do Espírito Santo, com o nome escrito como o CRM escreve.
 *
 * O CRM inteiro é do ES: o mapa do Dashboard, as coordenadas, a abordagem por
 * cidade e as licitações das cidades atendidas. Uma cidade de fora não é um
 * detalhe — é dado quebrado, que não desenha no mapa e não entra em conta
 * nenhuma. Foi assim que um cliente de Guaçuí apareceu como sendo de Recife:
 * a IA podia devolver qualquer texto e o CRM criava o município do jeito que
 * veio, sem conferir nada.
 */
export function municipioDoES(nome: unknown): string | null {
  if (typeof nome !== "string") return null;
  const chave = semAcento(nome).replace(/\s*[-,/]\s*(es|espirito santo)$/, "").replace(/\s+/g, " ").trim();
  if (!chave) return null;
  return ES_POR_CHAVE.get(chave) ?? null;
}

/** true quando o município gravado não é do ES — serve para a faxina. */
export function municipioForaDoES(nome: string): boolean {
  return municipioDoES(nome) === null;
}

// Um modelo de máquina tem letra e número ("B110", "E145C EVO", "CA25 D").
// Texto genérico ("retroescavadeira", "uma máquina") não é modelo e não pode
// virar "máquina definida" no card.
const PARECE_MODELO = /[a-z]\s?-?\d|\d\s?-?[a-z]/i;
const GENERICO = /^(maquina|equipamento|a definir|indefinido|retroescavadeira|escavadeira|pa carregadeira|motoniveladora|rolo|rolo compactador|mini escavadeira|nenhum|null|-|\?)$/;

export function normalizarModelo(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const v = valor.trim().replace(/\s+/g, " ");
  if (!v || GENERICO.test(semAcento(v))) return null;
  if (!PARECE_MODELO.test(v)) return null;
  return v.slice(0, 60);
}

export function normalizarMarca(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const v = semAcento(valor);
  for (const m of MARCAS_VALIDAS) if (semAcento(m) === v) return m;
  if (/new\s?holland|newholland|nh/.test(v)) return "New Holland";
  if (/dynapac/.test(v)) return "Dynapac";
  return null;
}

/**
 * Valor da NOSSA negociação, em reais.
 *
 * Aceita número puro e também o jeito que o vendedor escreve ("610 mil",
 * "R$ 610.000", "610.000,00"), porque o texto vem da nota dele. Recusa o que
 * não faz preço de máquina pesada: abaixo de mil não é valor de máquina, é
 * número solto da conversa (horas, parcelas, percentual).
 */
const VALOR_MIN = 1_000;
const VALOR_MAX = 100_000_000;

export function normalizarValor(valor: unknown): number | null {
  let n: number | null = null;
  if (typeof valor === "number" && Number.isFinite(valor)) {
    n = valor;
  } else if (typeof valor === "string") {
    const t = semAcento(valor).replace(/r\$\s*/g, "").trim();
    const mil = /^([\d.,]+)\s*(mil|k)$/.exec(t);
    const milhao = /^([\d.,]+)\s*(milhao|milhoes|mi|kk)$/.exec(t);
    const numero = (s: string) => {
      // "610.000,00" (pt-BR) e "610000.00" (ponto decimal) no mesmo caminho.
      const limpo = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/\.(?=\d{3}\b)/g, "");
      const x = Number(limpo);
      return Number.isFinite(x) ? x : null;
    };
    if (mil) { const x = numero(mil[1]); n = x == null ? null : x * 1_000; }
    else if (milhao) { const x = numero(milhao[1]); n = x == null ? null : x * 1_000_000; }
    else n = numero(t);
  }
  if (n == null || !Number.isFinite(n)) return null;
  const arredondado = Math.round(n);
  if (arredondado < VALOR_MIN || arredondado > VALOR_MAX) return null;
  return arredondado;
}

/** Valida o bloco "fatos" que o Orientador devolve. O que não passa vira null. */
export function normalizarFatos(bruto: unknown): FatosNegociacao {
  if (!bruto || typeof bruto !== "object") return { ...FATOS_VAZIOS };
  const f = bruto as Record<string, unknown>;
  return {
    marca: normalizarMarca(f.marca),
    maquinaModelo: normalizarModelo(f.maquinaModelo ?? f.maquina ?? f.modelo),
    valor: normalizarValor(f.valor ?? f.valorNegociado),
    condicaoPagamento: normalizarPagamento(f.condicaoPagamento ?? f.pagamento),
    municipio: municipioDoES(f.municipio ?? f.cidade),
    // Só true/false explícito conta; qualquer outra coisa é "não disse".
    visitaRealizada: typeof f.visitaRealizada === "boolean" ? f.visitaRealizada : null,
    entradaValor: normalizarValor(f.entradaValor ?? f.entrada),
    entradaPercentual: normalizarPercentual(f.entradaPercentual),
    observacao: normalizarObservacao(f.observacao ?? f.obs),
  };
}

/**
 * O que gravar na negociação.
 *
 * Regra, e ela é o coração da correção: campo vazio sempre é preenchido; campo
 * já preenchido só é trocado quando o vendedor escreveu uma nota. A nota é ele
 * falando — esteve na visita, ligou, ouviu o cliente — e nesse momento o que
 * ele diz vale mais do que o que a conversa sugeria antes. Sem nota, o
 * Orientador não mexe no que já está lá, para uma leitura automática nunca
 * apagar um dado que uma pessoa digitou.
 */
export function mudancasDaNegociacao(
  atual: { marca: string | null; maquinaModelo: string | null; valor: number | null; tipoPagamento: string | null; entradaValor?: number | null; entradaPercentual?: number | null; observacao?: string | null },
  fatos: FatosNegociacao,
  temNota: boolean,
): Partial<{ marca: string; maquinaModelo: string; valor: number; tipoPagamento: string; condicaoPagamento: string; entradaValor: number; entradaPercentual: number; observacao: string }> {
  const mud: Record<string, string | number> = {};
  const poeTexto = (campo: string, novo: string | null, velho: string | null) => {
    if (!novo) return;
    if (!velho?.trim()) { mud[campo] = novo; return; }
    if (temNota && novo !== velho) mud[campo] = novo;
  };

  poeTexto("marca", fatos.marca, atual.marca);
  poeTexto("maquinaModelo", fatos.maquinaModelo, atual.maquinaModelo);

  if (fatos.valor != null) {
    const vazio = atual.valor == null || atual.valor <= 0;
    if (vazio || (temNota && fatos.valor !== atual.valor)) mud.valor = fatos.valor;
  }

  if (fatos.entradaValor != null) {
    const vazio = atual.entradaValor == null || atual.entradaValor <= 0;
    if (vazio || (temNota && fatos.entradaValor !== atual.entradaValor)) mud.entradaValor = fatos.entradaValor;
  }
  if (fatos.entradaPercentual != null) {
    const vazio = atual.entradaPercentual == null || atual.entradaPercentual <= 0;
    if (vazio || (temNota && fatos.entradaPercentual !== atual.entradaPercentual)) mud.entradaPercentual = fatos.entradaPercentual;
  }
  poeTexto("observacao", fatos.observacao, atual.observacao ?? null);

  if (fatos.condicaoPagamento) {
    // "outro" no banco conta como vazio: não é forma de pagamento nenhuma.
    const atualValido = normalizarPagamento(atual.tipoPagamento);
    if (!atualValido || (temNota && fatos.condicaoPagamento !== atualValido)) {
      mud.tipoPagamento = fatos.condicaoPagamento;
      // Limpa o texto livre antigo para os dois campos não se contradizerem.
      mud.condicaoPagamento = "";
    }
  }
  return mud as Partial<{ marca: string; maquinaModelo: string; valor: number; tipoPagamento: string; condicaoPagamento: string; entradaValor: number; entradaPercentual: number; observacao: string }>;
}

/**
 * Marca a etapa "Visita" do roteiro como feita quando o vendedor disse que já
 * esteve com o cliente.
 *
 * Por que não deixar só a IA fazer: o roteiro sai da mesma resposta, e depender
 * de ela lembrar de mexer nele TODA vez é frágil — basta um descuido e o painel
 * diz ao vendedor que falta fazer o que ele já fez. Com o booleano, a marcação
 * é garantida. O caminho contrário não existe de propósito: o Orientador não
 * DESMARCA uma etapa que a conversa mostrou cumprida.
 */
export function marcarVisitaNoRoteiro<T extends { etapa: string; status: string }>(
  roteiro: T[],
  visitaRealizada: boolean | null,
): T[] {
  if (visitaRealizada !== true) return roteiro;
  let mexeu = false;
  const novo = roteiro.map((e) => {
    if (e.status === "feito" || !/visita/i.test(semAcento(e.etapa))) return e;
    mexeu = true;
    return { ...e, status: "feito" };
  });
  if (!mexeu) return roteiro;

  // A etapa "agora" some junto com a visita: quem estava em "Visita" avança
  // para a primeira etapa seguinte que ainda não foi feita.
  if (!novo.some((e) => e.status === "agora")) {
    const i = novo.findIndex((e) => e.status !== "feito");
    if (i >= 0) novo[i] = { ...novo[i], status: "agora" };
  }
  return novo as T[];
}

/** Percentual de entrada: 0 a 100. Fora disso é erro de leitura. */
export function normalizarPercentual(valor: unknown): number | null {
  const n = typeof valor === "number" ? valor : typeof valor === "string" ? Number(valor.replace("%", "").replace(",", ".").trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 100) return null;
  return Math.round(n * 10) / 10;
}

/**
 * Observação da negociação. Curta de propósito: é uma linha no card, não um
 * campo de texto livre — o que não couber aqui vai na caixa de contexto.
 */
export function normalizarObservacao(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const v = valor.trim().replace(/\s+/g, " ");
  if (!v || GENERICO.test(semAcento(v))) return null;
  return v.slice(0, 240);
}
