// Filtro de contatos indesejados (contabilidade, bancos, financeiras, hotéis,
// restaurantes…) — o "espaço de configuração" de Clientes/WhatsApp: a lista
// vive em Configuracao (editável pelo card de Configurações, manual ou pelo
// assistente de configuração) em vez de fixa no código.
//
// UMA lista só, de PALAVRAS INTEIRAS (01/10, pedido do vendedor). Havia uma
// segunda, de "pedaços de palavra", gravada em filtro.contatos.termos. O que
// estiver lá passa a valer como palavra inteira — o que só estreita o filtro,
// nunca alarga — e a primeira edição do card a esvazia.

import { getConfig, setConfig } from "@/lib/config";
import { PALAVRAS_BLOQUEIO_PADRAO, motivoBloqueioComListas } from "@/lib/utils";

const CHAVE_TERMOS_ANTIGA = "filtro.contatos.termos";
const CHAVE_PALAVRAS = "filtro.contatos.palavras";
// Cache em memória (por instância do servidor): motivoBloqueio/deveDescartarContato
// são chamados em massa (varrendo listas de clientes) — sem isso, cada chamada
// seria um round-trip ao banco. Recarrega sozinho a cada 30s, e na hora quando
// o próprio card/assistente edita a lista.
const TTL_MS = 30_000;
let cache: ListaFiltro | null = null;
let cacheEm = 0;

export type ListaFiltro = { palavras: string[] };

const limpar = (arr: string[]): string[] =>
  Array.from(new Set(arr.map((s) => s.trim().toLowerCase()).filter(Boolean)));

function lerLista(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : null;
  } catch {
    return null;
  }
}

/** Pura: a lista que vale, juntando a de palavras com a antiga de pedaços. */
export function listaQueVale(palavrasGravadas: string | null, termosGravados: string | null): string[] {
  const palavras = lerLista(palavrasGravadas) ?? PALAVRAS_BLOQUEIO_PADRAO;
  return limpar([...palavras, ...(lerLista(termosGravados) ?? [])]);
}

async function carregar(): Promise<ListaFiltro> {
  if (cache && Date.now() - cacheEm < TTL_MS) return cache;
  const [rp, rt] = await Promise.all([getConfig(CHAVE_PALAVRAS), getConfig(CHAVE_TERMOS_ANTIGA)]);
  cache = { palavras: listaQueVale(rp, rt) };
  cacheEm = Date.now();
  return cache;
}

export async function listarFiltroContatos(): Promise<ListaFiltro> {
  return carregar();
}

export async function motivoBloqueio(nome: string): Promise<string | null> {
  const { palavras } = await carregar();
  return motivoBloqueioComListas(nome, [], palavras);
}

export async function deveDescartarContato(nome: string): Promise<boolean> {
  return (await motivoBloqueio(nome)) !== null;
}

// Substitui a lista inteira (usado pelo card e pelo assistente depois de
// calcular o resultado final). Esvazia a antiga de pedaços: o que estava lá já
// veio junto na lista lida, e não pode voltar depois de ele remover.
export async function definirFiltroContatos(palavras: string[]): Promise<ListaFiltro> {
  const p = limpar(palavras);
  await Promise.all([setConfig(CHAVE_PALAVRAS, JSON.stringify(p)), setConfig(CHAVE_TERMOS_ANTIGA, "[]")]);
  cache = { palavras: p };
  cacheEm = Date.now();
  return cache;
}

export async function adicionarPalavraFiltro(valor: string): Promise<ListaFiltro> {
  const atual = await carregar();
  const v = valor.trim().toLowerCase();
  if (!v) return atual;
  return definirFiltroContatos([...atual.palavras, v]);
}

export async function removerPalavraFiltro(valor: string): Promise<ListaFiltro> {
  const atual = await carregar();
  const v = valor.trim().toLowerCase();
  return definirFiltroContatos(atual.palavras.filter((p) => p !== v));
}
