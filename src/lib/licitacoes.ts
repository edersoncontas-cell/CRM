// Licitações de MÁQUINAS nas cidades que o vendedor atende.
//
// Prefeitura comprando retroescavadeira, pá carregadeira, motoniveladora ou
// rolo é venda na porta — e some no meio de centenas de editais de merenda e
// material de escritório. Este robô lê o PNCP (Portal Nacional de
// Contratações Públicas, o portal oficial de todas as compras públicas do
// país, aberto e sem chave), fica só com o que é máquina e só com as cidades
// da área, e guarda o resultado.
//
// Mesmo desenho do mercado/café: o cron busca ao vivo e grava; a tela só lê
// o que está gravado, para nunca depender de uma chamada externa para abrir.

import { db } from "@/lib/db";
import { getConfig, setConfig } from "@/lib/config";

const CHAVE_ULTIMA = "licitacoes.ultima";
const CACHE_MS = 5 * 60 * 1000;
const PNCP = "https://pncp.gov.br/api/consulta/v1/contratacoes/proposta";

/**
 * Modalidades que compram máquina, com o nome para o diagnóstico.
 *
 * Faltavam as PRESENCIAIS, e é onde mora boa parte da compra de máquina no
 * interior: Dores do Rio Preto, Divino de São Lourenço e Ibitirama ainda
 * rodam pregão presencial. Olhar só o eletrônico deixava esses editais
 * invisíveis — o painel não estava errado, estava cego para eles.
 */
export const MODALIDADES: { codigo: number; nome: string }[] = [
  { codigo: 6, nome: "Pregão eletrônico" },
  { codigo: 7, nome: "Pregão presencial" },
  { codigo: 4, nome: "Concorrência eletrônica" },
  { codigo: 5, nome: "Concorrência presencial" },
  { codigo: 8, nome: "Dispensa" },
];

const TEMPO_MS = 12000;
/**
 * 50 é o tamanho de página documentado nas consultas do PNCP. A busca pedia
 * 200 — acima do limite, o portal responde 400 e a modalidade inteira se
 * perde. Não deu para confirmar o código de resposta daqui (a rede do
 * ambiente não alcança o pncp.gov.br), mas 50 é seguro nos dois cenários:
 * se 200 era aceito, o único efeito é ler mais páginas, e agora o robô
 * pagina de qualquer jeito.
 */
export const POR_PAGINA = 50;
/** Teto de páginas por modalidade — o ES inteiro cabe com folga. */
export const MAX_PAGINAS = 20;
/** Orçamento de tempo da rodada inteira: o cron da Vercel corta em 60 s. */
export const PRAZO_TOTAL_MS = 40_000;

/**
 * O portal barrou o CRM com 429 em todas as modalidades. Portal público não
 * gosta de rajada nem de requisição anônima — estas três constantes são a
 * resposta a isso: o robô se identifica, respira entre as páginas e recua
 * quando é mandado recuar.
 */
export const USER_AGENT = "CRM-NewHolland-Dynapac-ES/1.0 (robô de licitações de máquinas; contato pelo CRM)";
export const PAUSA_ENTRE_PAGINAS_MS = 250;
export const TENTATIVAS_429 = 3;

export type Licitacao = {
  id: string;
  orgao: string;
  cidade: string;
  objeto: string;
  valor: number | null;
  abertura: string | null;   // ISO — quando começa a receber proposta
  encerramento: string | null; // ISO — prazo para entregar a proposta
  modalidade: string | null;
  link: string | null;
  termos: string[]; // o que casou ("retroescavadeira", "pá carregadeira"…)
};

/** Como foi a leitura de UMA modalidade — é o que permite enxergar o robô. */
export type LeituraModalidade = {
  nome: string;
  editaisLidos: number;
  paginas: number;
  erro: string | null;
};

export type LicitacoesGuardadas = {
  em: string | null;
  itens: Licitacao[];
  cidadesOlhadas: number;
  erro: string | null;
  /** Quantos editais foram lidos no total (antes de filtrar por máquina). */
  editaisLidos?: number;
  /** Detalhe por modalidade, para a tela dizer o que o robô fez. */
  leituras?: LeituraModalidade[];
};

// O que interessa. Só termo de máquina — "veículo" e "caminhão" ficam de
// fora de propósito: enchem a lista de carro de passeio e caçamba, que não é
// o que ele vende.
const TERMOS = [
  "retroescavadeira", "retro escavadeira", "escavadeira", "miniescavadeira",
  "pá carregadeira", "pa carregadeira", "carregadeira",
  "motoniveladora", "patrol",
  "rolo compactador", "compactador de solo", "rolo vibratório", "rolo vibratorio",
  "trator de esteira", "trator agrícola", "trator agricola",
  "máquina pesada", "maquina pesada", "equipamento rodoviário", "equipamento rodoviario",
];

// Palavras que derrubam o edital mesmo tendo casado acima: é conserto/aluguel
// de máquina, não compra. Locação até pode virar conversa, mas não é venda e
// misturado atrapalha a leitura.
const DESCARTE = [
  "locação", "locacao", "aluguel", "manutenção", "manutencao", "conserto",
  "peças", "pecas", "reforma", "recuperação de", "recuperacao de", "seguro",
];

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Termos de máquina que aparecem no objeto do edital ([] = não interessa).
 *
 * A regra do descarte olha a POSIÇÃO, não a mera presença. O que manda no
 * edital é o que vem antes da máquina:
 *
 *   "locação de retroescavadeira"            → locação ANTES  → fora
 *   "aquisição de peças para motoniveladora" → peças ANTES    → fora
 *   "aquisição de retroescavadeira com manutenção por 12 meses"
 *                                            → manutenção DEPOIS → ENTRA
 *
 * Antes bastava a palavra aparecer em qualquer lugar, e era um buraco de
 * verdade: quase todo edital de compra de máquina cita garantia, manutenção
 * ou peças de reposição nas condições. O painel descartava justamente as
 * compras mais bem especificadas — as que mais interessam.
 */
export function termosDeMaquina(objeto: string): string[] {
  const o = semAcento(objeto);
  const achados = TERMOS.filter((t) => o.includes(semAcento(t)));
  if (!achados.length) return [];

  // Onde a primeira máquina é citada.
  const primeiraMaquina = Math.min(...achados.map((t) => o.indexOf(semAcento(t))));
  // Alguma palavra de descarte aparece ANTES dela? Então o edital é sobre
  // aquilo — conserto, aluguel, peça — e não sobre comprar a máquina.
  const descartado = DESCARTE.some((d) => {
    const i = o.indexOf(semAcento(d));
    return i !== -1 && i < primeiraMaquina;
  });
  if (descartado) return [];

  // "escavadeira" casa dentro de "retroescavadeira": fica só o mais específico.
  return achados.filter((t) => !achados.some((outro) => outro !== t && outro.includes(t)));
}

/** A licitação é de uma cidade que o vendedor atende? */
export function cidadeAtendida(cidadeDoEdital: string, cidades: string[]): string | null {
  const alvo = semAcento(cidadeDoEdital).trim();
  if (!alvo) return null;
  return cidades.find((c) => semAcento(c).trim() === alvo) ?? null;
}

type Obj = Record<string, unknown>;
const txt = (o: Obj, ...chaves: string[]): string | null => {
  for (const k of chaves) { const v = o[k]; if (typeof v === "string" && v.trim()) return v.trim(); }
  return null;
};

/** Normaliza um item do PNCP — os nomes de campo variam entre versões. */
export function normalizarItemPncp(item: Obj): Omit<Licitacao, "termos" | "cidade"> & { cidade: string } | null {
  const unidade = (item.unidadeOrgao ?? item.orgaoEntidade ?? {}) as Obj;
  const objeto = txt(item, "objetoCompra", "objeto", "informacaoComplementar");
  if (!objeto) return null;
  const cidade = txt(unidade, "municipioNome", "nomeMunicipio", "municipio") ?? "";
  const orgao = txt(unidade, "nomeUnidade", "razaoSocial")
    ?? txt((item.orgaoEntidade ?? {}) as Obj, "razaoSocial", "nome")
    ?? "Órgão público";
  const valorBruto = item.valorTotalEstimado ?? item.valorTotal ?? null;
  const numero = txt(item, "numeroControlePNCP", "numeroCompra") ?? "";
  return {
    id: numero || `${cidade}-${objeto.slice(0, 40)}`,
    orgao,
    cidade,
    objeto,
    valor: typeof valorBruto === "number" && valorBruto > 0 ? valorBruto : null,
    abertura: txt(item, "dataAberturaProposta", "dataPublicacaoPncp"),
    encerramento: txt(item, "dataEncerramentoProposta", "dataEncerramentoPropostaPncp"),
    modalidade: txt(item, "modalidadeNome", "modalidadeContratacaoNome"),
    link: txt(item, "linkSistemaOrigem") ?? (numero ? `https://pncp.gov.br/app/editais/${numero.replace(/\//g, "-")}` : null),
  };
}

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Quanto esperar depois de um 429.
 *
 * O portal costuma dizer no cabeçalho `Retry-After` (em segundos). Quando não
 * diz, a espera cresce a cada tentativa: 1s, 2s, 4s. Teto de 8s por tentativa
 * porque o cron inteiro tem 60 s — esperar mais seria trocar um erro por um
 * corte no meio.
 */
export function esperaDoRetryAfter(cabecalho: string | null, tentativa: number): number {
  const s = Number(cabecalho);
  if (Number.isFinite(s) && s > 0) return Math.min(s * 1000, 8_000);
  return Math.min(1000 * 2 ** (tentativa - 1), 8_000);
}

/**
 * Lê UMA página do PNCP, com educação.
 *
 * O portal respondeu 429 em TODAS as modalidades — limite de acesso, não
 * tamanho de pedido. Três coisas mudam isso:
 *
 *  1. IDENTIFICAÇÃO. Requisição sem User-Agent parece robô anônimo e é a
 *     primeira a ser barrada em portal público. Agora o CRM se apresenta.
 *  2. RECUO. Em 429, espera o que o portal mandar esperar (Retry-After) e
 *     tenta de novo, em vez de desistir na hora e perder a modalidade inteira.
 *  3. PACIÊNCIA ENTRE PÁGINAS — ver buscarModalidade.
 */
async function buscarPagina(modalidade: number, dataFinal: string, pagina: number): Promise<{ itens: Obj[]; totalPaginas: number }> {
  const url = `${PNCP}?dataFinal=${dataFinal}&codigoModalidadeContratacao=${modalidade}&uf=ES&pagina=${pagina}&tamanhoPagina=${POR_PAGINA}`;

  for (let tentativa = 1; tentativa <= TENTATIVAS_429; tentativa++) {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(TEMPO_MS),
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    // 204 = o PNCP diz "não há nada com estes filtros". Não é erro.
    if (res.status === 204) return { itens: [], totalPaginas: 0 };
    if (res.status === 429 && tentativa < TENTATIVAS_429) {
      await dormir(esperaDoRetryAfter(res.headers.get("retry-after"), tentativa));
      continue;
    }
    if (!res.ok) {
      throw new Error(res.status === 429
        ? "PNCP limitou o acesso (429) — tentamos de novo e ele manteve"
        : `PNCP respondeu ${res.status}`);
    }
    const json = (await res.json()) as Obj;
    const dados = json.data ?? json.items ?? json;
    const total = typeof json.totalPaginas === "number" ? json.totalPaginas : 1;
    return { itens: Array.isArray(dados) ? (dados as Obj[]) : [], totalPaginas: total };
  }
  throw new Error("PNCP limitou o acesso (429) — tentamos de novo e ele manteve");
}

/**
 * Lê a modalidade INTEIRA, página a página.
 *
 * Este era o defeito central: a busca pedia uma página só e parava. O PNCP
 * devolve todas as contratações abertas do Espírito Santo — milhares — e a
 * compra de máquina é um punhado no meio. Filtrar 50 registros sorteados de
 * milhares e concluir "nenhum edital de máquina" não era uma resposta: era um
 * palpite. Agora o robô varre tudo e o painel passa a dizer quantos editais
 * de fato olhou.
 */
async function buscarModalidade(modalidade: number, dataFinal: string, limite: number): Promise<{ itens: Obj[]; paginas: number }> {
  const todos: Obj[] = [];
  let paginas = 0;
  const primeira = await buscarPagina(modalidade, dataFinal, 1);
  todos.push(...primeira.itens);
  paginas = 1;
  const ate = Math.min(primeira.totalPaginas, MAX_PAGINAS);
  for (let p = 2; p <= ate; p++) {
    // O cron tem 60 s. Melhor entregar o que já leu do que ser cortado no
    // meio e não gravar nada.
    if (Date.now() > limite) break;
    // Um respiro entre páginas. Disparar 100 requisições em rajada é o jeito
    // mais rápido de um portal público te barrar — e barrou.
    await dormir(PAUSA_ENTRE_PAGINAS_MS);
    const r = await buscarPagina(modalidade, dataFinal, p);
    todos.push(...r.itens);
    paginas++;
    if (!r.itens.length) break;
  }
  return { itens: todos, paginas };
}

/** Cidades da área de atuação (as que estão no CRM e não foram marcadas fora). */
async function cidadesDaArea(): Promise<string[]> {
  const ms = await db.municipio.findMany({ where: { foraDeArea: false }, select: { nome: true } });
  return ms.map((m) => m.nome);
}

/**
 * Busca AO VIVO no PNCP e grava. Chamada pelo cron; as telas usam
 * obterLicitacoes(), que só lê o que já está gravado.
 */
export async function atualizarLicitacoes(): Promise<LicitacoesGuardadas> {
  const cidades = await cidadesDaArea();
  const hoje = new Date();
  // Janela: editais com proposta aberta até 90 dias à frente.
  const ate = new Date(hoje.getTime() + 90 * 86400000);
  const dataFinal = `${ate.getFullYear()}${String(ate.getMonth() + 1).padStart(2, "0")}${String(ate.getDate()).padStart(2, "0")}`;

  const achados = new Map<string, Licitacao>();
  const leituras: LeituraModalidade[] = [];
  const limite = Date.now() + PRAZO_TOTAL_MS;
  let erro: string | null = null;
  let editaisLidos = 0;

  for (const m of MODALIDADES) {
    try {
      const { itens, paginas } = await buscarModalidade(m.codigo, dataFinal, limite);
      editaisLidos += itens.length;
      leituras.push({ nome: m.nome, editaisLidos: itens.length, paginas, erro: null });
      for (const bruto of itens) {
        const it = normalizarItemPncp(bruto);
        if (!it) continue;
        const termos = termosDeMaquina(it.objeto);
        if (!termos.length) continue;
        const cidade = cidadeAtendida(it.cidade, cidades);
        if (!cidade) continue;
        achados.set(it.id, { ...it, cidade, termos });
      }
    } catch (e) {
      // Uma modalidade falhar não pode derrubar as outras.
      const msg = e instanceof Error ? e.message : String(e);
      erro = msg;
      leituras.push({ nome: m.nome, editaisLidos: 0, paginas: 0, erro: msg });
      console.error(`[licitacoes] modalidade ${m.nome} (${m.codigo}):`, e);
    }
  }

  // ACUMULA EM VEZ DE SUBSTITUIR.
  //
  // O portal limita o acesso (429), então rodada parcial é o normal, não a
  // exceção. Trocar o resultado inteiro pelo da última rodada fazia um 429
  // APAGAR editais que já tinham sido encontrados — o vendedor perdia venda
  // por causa de um limite de acesso momentâneo. Agora cada rodada SOMA:
  // o que já estava continua valendo até o prazo dele vencer.
  const anterior = await obterLicitacoes();
  const agora = Date.now();
  const vivo = (l: Licitacao) => !l.encerramento || Date.parse(l.encerramento) >= agora;
  for (const l of anterior.itens) {
    if (vivo(l) && !achados.has(l.id)) achados.set(l.id, l);
  }

  const itens = [...achados.values()].sort((a, b) => {
    const da = a.encerramento ? Date.parse(a.encerramento) : Infinity;
    const db_ = b.encerramento ? Date.parse(b.encerramento) : Infinity;
    return da - db_; // o que fecha primeiro é o que corre risco de passar batido
  });

  const guardado: LicitacoesGuardadas = {
    em: new Date().toISOString(),
    itens: itens.slice(0, 40),
    cidadesOlhadas: cidades.length,
    editaisLidos,
    leituras,
    // Só reporta erro quando o robô não conseguiu LER nada. Erro numa
    // modalidade com leitura nas outras não é problema do vendedor — mas
    // "nenhum edital de máquina" com ZERO editais lidos é falha, não
    // ausência, e antes as duas coisas apareciam iguais na tela.
    erro: editaisLidos > 0 ? null : erro,
  };
  await setConfig(CHAVE_ULTIMA, JSON.stringify(guardado));
  cacheMem = null;
  return guardado;
}

let cacheMem: { em: number; dados: LicitacoesGuardadas } | null = null;

/** Leitura rápida para as telas: nunca busca ao vivo, só lê o que está gravado. */
export async function obterLicitacoes(): Promise<LicitacoesGuardadas> {
  if (cacheMem && Date.now() - cacheMem.em < CACHE_MS) return cacheMem.dados;
  let ultima: LicitacoesGuardadas | null = null;
  try { ultima = JSON.parse((await getConfig(CHAVE_ULTIMA)) ?? "null"); } catch { ultima = null; }
  const dados: LicitacoesGuardadas = ultima ?? { em: null, itens: [], cidadesOlhadas: 0, erro: null };
  cacheMem = { em: Date.now(), dados };
  return dados;
}
