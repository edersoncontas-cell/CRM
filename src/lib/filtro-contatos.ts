// Filtro de contatos indesejados (contabilidade, bancos, financeiras, hotéis,
// restaurantes…) — o "espaço de configuração" de Clientes/WhatsApp: as listas
// vivem em Configuracao (editáveis pelo card de Configurações, manual ou pelo
// assistente de configuração) em vez de fixas no código.

import { getConfig, setConfig } from "@/lib/config";
import { TERMOS_BLOQUEIO_PADRAO, PALAVRAS_BLOQUEIO_PADRAO, motivoBloqueioComListas } from "@/lib/utils";

const CHAVE_TERMOS = "filtro.contatos.termos";
const CHAVE_PALAVRAS = "filtro.contatos.palavras";
// Cache em memória (por instância do servidor): motivoBloqueio/deveDescartarContato
// são chamados em massa (varrendo listas de clientes) — sem isso, cada chamada
// seria um round-trip ao banco. Recarrega sozinho a cada 30s, e na hora quando
// o próprio card/assistente edita a lista.
const TTL_MS = 30_000;
let cache: { termos: string[]; palavras: string[] } | null = null;
let cacheEm = 0;

async function carregar(): Promise<{ termos: string[]; palavras: string[] }> {
  if (cache && Date.now() - cacheEm < TTL_MS) return cache;
  const [rt, rp] = await Promise.all([getConfig(CHAVE_TERMOS), getConfig(CHAVE_PALAVRAS)]);
  const termos = rt ? (JSON.parse(rt) as string[]) : TERMOS_BLOQUEIO_PADRAO;
  const palavras = rp ? (JSON.parse(rp) as string[]) : PALAVRAS_BLOQUEIO_PADRAO;
  cache = { termos, palavras };
  cacheEm = Date.now();
  return cache;
}

export async function listarFiltroContatos(): Promise<{ termos: string[]; palavras: string[] }> {
  return carregar();
}

export async function motivoBloqueio(nome: string): Promise<string | null> {
  const { termos, palavras } = await carregar();
  return motivoBloqueioComListas(nome, termos, palavras);
}

export async function deveDescartarContato(nome: string): Promise<boolean> {
  return (await motivoBloqueio(nome)) !== null;
}

const limpar = (arr: string[]): string[] =>
  Array.from(new Set(arr.map((s) => s.trim().toLowerCase()).filter(Boolean)));

// Substitui as duas listas inteiras (usado pelo formulário e pelo assistente
// depois de calcular o resultado final).
export async function definirFiltroContatos(termos: string[], palavras: string[]): Promise<{ termos: string[]; palavras: string[] }> {
  const t = limpar(termos);
  const p = limpar(palavras);
  await Promise.all([setConfig(CHAVE_TERMOS, JSON.stringify(t)), setConfig(CHAVE_PALAVRAS, JSON.stringify(p))]);
  cache = { termos: t, palavras: p };
  cacheEm = Date.now();
  return cache;
}

export type { TipoTermoBloqueio } from "@/lib/filtro-contatos-plano";
import type { TipoTermoBloqueio } from "@/lib/filtro-contatos-plano";

export async function adicionarTermoFiltro(tipo: TipoTermoBloqueio, valor: string): Promise<{ termos: string[]; palavras: string[] }> {
  const atual = await carregar();
  const v = valor.trim().toLowerCase();
  if (!v) return atual;
  return definirFiltroContatos(
    tipo === "termo" ? [...atual.termos, v] : atual.termos,
    tipo === "palavra" ? [...atual.palavras, v] : atual.palavras
  );
}

export async function removerTermoFiltro(tipo: TipoTermoBloqueio, valor: string): Promise<{ termos: string[]; palavras: string[] }> {
  const atual = await carregar();
  const v = valor.trim().toLowerCase();
  return definirFiltroContatos(
    tipo === "termo" ? atual.termos.filter((t) => t !== v) : atual.termos,
    tipo === "palavra" ? atual.palavras.filter((p) => p !== v) : atual.palavras
  );
}
