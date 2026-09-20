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
// Modalidades que compram máquina: pregão eletrônico, concorrência, dispensa.
const MODALIDADES = [6, 4, 8];
const TEMPO_MS = 12000;

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

export type LicitacoesGuardadas = {
  em: string | null;
  itens: Licitacao[];
  cidadesOlhadas: number;
  erro: string | null;
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

/** Termos de máquina que aparecem no objeto do edital ([] = não interessa). */
export function termosDeMaquina(objeto: string): string[] {
  const o = semAcento(objeto);
  if (DESCARTE.some((d) => o.includes(semAcento(d)))) return [];
  const achados = TERMOS.filter((t) => o.includes(semAcento(t)));
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

async function buscarModalidade(modalidade: number, dataFinal: string): Promise<Obj[]> {
  const url = `${PNCP}?dataFinal=${dataFinal}&codigoModalidadeContratacao=${modalidade}&uf=ES&pagina=1&tamanhoPagina=200`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(TEMPO_MS) });
  if (!res.ok) throw new Error(`PNCP respondeu ${res.status}`);
  const json = (await res.json()) as Obj;
  const dados = json.data ?? json.items ?? json;
  return Array.isArray(dados) ? (dados as Obj[]) : [];
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
  let erro: string | null = null;

  for (const modalidade of MODALIDADES) {
    try {
      const itens = await buscarModalidade(modalidade, dataFinal);
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
      erro = e instanceof Error ? e.message : String(e);
      console.error(`[licitacoes] modalidade ${modalidade}:`, e);
    }
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
    // Só reporta erro se NADA veio — erro numa modalidade com resultado nas
    // outras não é problema que o vendedor precise ver.
    erro: itens.length ? null : erro,
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
