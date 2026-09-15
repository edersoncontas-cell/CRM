// Notícias do setor para o letreiro e o painel do Dashboard — café, crédito
// e financiamento de máquinas, obras e infraestrutura (com foco no Espírito
// Santo), máquinas pesadas e as marcas vendidas. Fonte: Google Notícias via
// RSS (gratuito, sem chave, agrega os principais veículos). SÓ notícias de
// hoje e de até 2 dias atrás, as mais recentes primeiro (pedido do vendedor:
// "tempo real"). Cache de 5 min em memória + última lista boa gravada em
// Configuracao (cold start / falha), também filtrada pela idade.

import { getConfig, setConfig } from "@/lib/config";

export type Noticia = {
  titulo: string;
  link: string;
  fonte: string | null;
  tema: string;
  publicadoEm: string | null; // ISO
};

const CHAVE_ULTIMAS = "noticias_setor_ultimas";
const CACHE_MS = 5 * 60_000;
const TIMEOUT_MS = 8_000;
const MAX_NOTICIAS = 40;
// Idade máxima de uma notícia para aparecer: 2 dias.
export const IDADE_MAXIMA_MS = 2 * 24 * 60 * 60_000;

const BUSCAS: { q: string; tema: string }[] = [
  { q: "preço do café arábica conilon", tema: "Café" },
  { q: "café conilon Espírito Santo", tema: "Café" },
  { q: "crédito rural financiamento máquinas BNDES", tema: "Crédito" },
  { q: "financiamento máquinas pesadas juros", tema: "Crédito" },
  { q: "obras rodovias infraestrutura Espírito Santo", tema: "Obras" },
  { q: "construção civil máquinas pesadas terraplenagem", tema: "Máquinas" },
  { q: "New Holland Construction OR Dynapac", tema: "Marcas" },
  { q: "agronegócio Espírito Santo", tema: "Agro" },
];

let cacheMem: { em: number; itens: Noticia[] } | null = null;

const decodificar = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, "").trim();

const campo = (item: string, tag: string) => {
  const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodificar(m[1]) : null;
};

function parseRss(xml: string, tema: string): Noticia[] {
  const itens: Noticia[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const bloco = m[1];
    let titulo = campo(bloco, "title") ?? "";
    const link = campo(bloco, "link") ?? "";
    let fonte = campo(bloco, "source");
    // Google Notícias põe " - Fonte" no fim do título.
    const sep = titulo.lastIndexOf(" - ");
    if (sep > 10) { if (!fonte) fonte = titulo.slice(sep + 3).trim(); titulo = titulo.slice(0, sep).trim(); }
    const pub = campo(bloco, "pubDate");
    const data = pub ? new Date(pub) : null;
    if (!titulo || !link) continue;
    itens.push({ titulo, link, fonte, tema, publicadoEm: data && !Number.isNaN(data.getTime()) ? data.toISOString() : null });
  }
  return itens;
}

async function buscarRss(q: string, tema: string): Promise<Noticia[]> {
  try {
    // "when:2d" pede ao Google só os últimos 2 dias; o filtro por data abaixo garante.
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:2d`)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CRM-NewHolland/1.0)" }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return [];
    return parseRss(await res.text(), tema).slice(0, 8);
  } catch {
    return [];
  }
}

// Mantém só o que tem data e é de até 2 dias atrás; mais recentes primeiro.
export function recentesPrimeiro(itens: Noticia[], agora = Date.now()): Noticia[] {
  return itens
    .filter((n) => n.publicadoEm && agora - new Date(n.publicadoEm).getTime() <= IDADE_MAXIMA_MS && new Date(n.publicadoEm).getTime() <= agora + 60 * 60_000)
    .sort((a, b) => (b.publicadoEm ?? "").localeCompare(a.publicadoEm ?? ""));
}

const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Busca AO VIVO (Google Notícias RSS). Chamada pelo cron /api/cron/mercado.
export async function atualizarNoticias(): Promise<{ itens: Noticia[]; atualizadoEm: string | null }> {

  const listas = await Promise.all(BUSCAS.map((b) => buscarRss(b.q, b.tema)));
  const vistos = new Set<string>();
  const todas: Noticia[] = [];
  for (const n of listas.flat()) {
    const chave = normalizar(n.titulo).slice(0, 80);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    todas.push(n);
  }
  const itens = recentesPrimeiro(todas).slice(0, MAX_NOTICIAS);

  if (itens.length) {
    cacheMem = { em: Date.now(), itens };
    await setConfig(CHAVE_ULTIMAS, JSON.stringify({ em: new Date().toISOString(), itens })).catch(() => {});
    return { itens, atualizadoEm: new Date().toISOString() };
  }

  // Sem rede/falha: última lista boa.
  return lerUltimasNoticias();
}

async function lerUltimasNoticias(): Promise<{ itens: Noticia[]; atualizadoEm: string | null }> {
  try {
    const ultima = JSON.parse((await getConfig(CHAVE_ULTIMAS)) ?? "null") as { em: string; itens: Noticia[] } | null;
    const itens = recentesPrimeiro(ultima?.itens ?? []);
    if (itens.length) {
      cacheMem = { em: Date.now(), itens };
      return { itens, atualizadoEm: ultima!.em };
    }
  } catch {}
  return { itens: [], atualizadoEm: null };
}

// Leitura rápida para as telas: memória → gravado pelo robô → busca ao vivo
// só no primeiro uso (nunca houve leitura).
export async function obterNoticias(): Promise<{ itens: Noticia[]; atualizadoEm: string | null }> {
  if (cacheMem && Date.now() - cacheMem.em < CACHE_MS) return { itens: cacheMem.itens, atualizadoEm: new Date(cacheMem.em).toISOString() };
  const gravadas = await lerUltimasNoticias();
  if (gravadas.itens.length) return gravadas;
  return atualizarNoticias();
}
