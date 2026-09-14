// Robô da cotação do café no Espírito Santo. Busca o preço físico diário do
// conilon (e do arábica) em fontes públicas, na ordem:
//   1. CEPEA/ESALQ — indicador Robusta/Conilon ES (R$/saca 60 kg)
//   2. Notícias Agrícolas — tabela "Café conilon CEPEA/ESALQ"
//   3. CCCV — Centro do Comércio de Café de Vitória
// Grava um histórico diário em Configuracao (cafe.es.historico) e o último
// valor bom (cafe.es.ultimo). Roda pelo cron /api/cron/mercado; as telas só
// leem o que está gravado (nada de buscar site externo enquanto a página
// carrega). Se todas as fontes falharem, o último valor gravado continua
// valendo e o letreiro mostra a data dele.

import { getConfig, setConfig } from "@/lib/config";

const CHAVE_HISTORICO = "cafe.es.historico";
const CHAVE_ULTIMO = "cafe.es.ultimo";
const TIMEOUT_MS = 10_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type CotacaoCafeES = {
  conilon: number | null;      // R$/saca 60 kg
  arabica: number | null;      // R$/saca 60 kg (indicador nacional CEPEA, referência)
  dataReferencia: string | null; // dd/mm/aaaa da fonte
  fonte: string | null;
  atualizadoEm: string;        // ISO da leitura
  variacaoConilonPct: number | null; // vs. leitura anterior gravada
};

export type PontoHistoricoCafe = { data: string; conilon: number | null; arabica: number | null; fonte: string | null };

const numBR = (s: string): number | null => {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 50 && n < 20000 ? n : null;
};

async function baixar(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// Procura, dentro de um trecho de HTML, o primeiro par "dd/mm/aaaa ... 1.234,56".
function primeiroValor(html: string): { data: string; valor: number } | null {
  const limpo = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const m = limpo.match(/(\d{2}\/\d{2}\/\d{4})\s+([\d.]{1,7},\d{2})/);
  if (!m) return null;
  const valor = numBR(m[2]);
  return valor ? { data: m[1], valor } : null;
}

function trecho(html: string, marcador: RegExp, tamanho = 6000): string | null {
  const i = html.search(marcador);
  return i >= 0 ? html.slice(i, i + tamanho) : null;
}

async function fonteCepea(): Promise<Partial<CotacaoCafeES> | null> {
  const html = await baixar("https://www.cepea.esalq.usp.br/br/indicador/cafe.aspx");
  if (!html) return null;
  const robusta = trecho(html, /ROBUSTA|CONILON/i);
  const arabica = trecho(html, /AR[ÁA]BICA/i);
  const c = robusta ? primeiroValor(robusta) : null;
  const a = arabica ? primeiroValor(arabica) : null;
  if (!c && !a) return null;
  return { conilon: c?.valor ?? null, arabica: a?.valor ?? null, dataReferencia: c?.data ?? a?.data ?? null, fonte: "CEPEA/ESALQ" };
}

async function fonteNoticiasAgricolas(): Promise<Partial<CotacaoCafeES> | null> {
  const html = await baixar("https://www.noticiasagricolas.com.br/cotacoes/cafe/cafe-conilon-cepea-esalq");
  if (!html) return null;
  const t = trecho(html, /conilon/i, 20000) ?? html;
  const c = primeiroValor(t);
  if (!c) return null;
  return { conilon: c.valor, dataReferencia: c.data, fonte: "Notícias Agrícolas (CEPEA)" };
}

async function fonteCCCV(): Promise<Partial<CotacaoCafeES> | null> {
  const html = await baixar("https://www.cccv.org.br/cotacao/");
  if (!html) return null;
  const t = trecho(html, /conilon/i, 4000);
  if (!t) return null;
  const limpo = t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const m = limpo.match(/R\$\s*([\d.]{1,7},\d{2})/);
  const valor = m ? numBR(m[1]) : null;
  if (!valor) return null;
  const d = html.match(/(\d{2}\/\d{2}\/\d{4})/);
  return { conilon: valor, dataReferencia: d?.[1] ?? null, fonte: "CCCV" };
}

export async function lerCafeES(): Promise<CotacaoCafeES | null> {
  try {
    const raw = await getConfig(CHAVE_ULTIMO);
    return raw ? (JSON.parse(raw) as CotacaoCafeES) : null;
  } catch {
    return null;
  }
}

export async function lerHistoricoCafeES(): Promise<PontoHistoricoCafe[]> {
  try {
    const raw = await getConfig(CHAVE_HISTORICO);
    return raw ? (JSON.parse(raw) as PontoHistoricoCafe[]) : [];
  } catch {
    return [];
  }
}

// Executado pelo cron. Tenta as fontes em ordem; grava e devolve o resultado.
export async function atualizarCafeES(): Promise<{ ok: boolean; fonte: string | null; conilon: number | null }> {
  const anterior = await lerCafeES();
  const fontes = [fonteCepea, fonteNoticiasAgricolas, fonteCCCV];
  let achado: Partial<CotacaoCafeES> | null = null;
  for (const f of fontes) {
    achado = await f().catch(() => null);
    if (achado?.conilon) break;
  }
  if (!achado?.conilon) return { ok: false, fonte: null, conilon: anterior?.conilon ?? null };

  const variacao = anterior?.conilon && achado.conilon ? ((achado.conilon - anterior.conilon) / anterior.conilon) * 100 : null;
  const novo: CotacaoCafeES = {
    conilon: achado.conilon,
    arabica: achado.arabica ?? anterior?.arabica ?? null,
    dataReferencia: achado.dataReferencia ?? null,
    fonte: achado.fonte ?? null,
    atualizadoEm: new Date().toISOString(),
    variacaoConilonPct: variacao != null && Math.abs(variacao) < 25 ? variacao : anterior?.variacaoConilonPct ?? null,
  };
  await setConfig(CHAVE_ULTIMO, JSON.stringify(novo));

  // Histórico: um ponto por data de referência (ou por dia de leitura).
  const hist = await lerHistoricoCafeES();
  const chave = novo.dataReferencia ?? new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const semDup = hist.filter((h) => h.data !== chave);
  semDup.push({ data: chave, conilon: novo.conilon, arabica: novo.arabica, fonte: novo.fonte });
  await setConfig(CHAVE_HISTORICO, JSON.stringify(semDup.slice(-400)));
  return { ok: true, fonte: novo.fonte, conilon: novo.conilon };
}
