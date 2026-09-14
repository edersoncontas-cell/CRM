// Robô da cotação do café no Espírito Santo. Busca o preço físico da saca de
// conilon (e do arábica) em fontes públicas, na ordem:
//   1. Painel do Café (paineldocafe.com.br) — a fonte pedida pelo vendedor
//   2. CEPEA/ESALQ — indicador Robusta/Conilon ES (R$/saca 60 kg)
//   3. Notícias Agrícolas — tabela "Café conilon CEPEA/ESALQ"
//   4. CCCV — Centro do Comércio de Café de Vitória
// Em cada fonte tenta primeiro uma leitura direta (regex) e, se não achar,
// entrega o TEXTO da página para a IA extrair o preço (robusto a mudanças de
// layout). Grava um histórico diário em Configuracao (cafe.es.historico) e o
// último valor bom (cafe.es.ultimo).
//
// Quem chama: o cron /api/cron/mercado E a rota /api/mercado/ticker, que o
// Dashboard consulta toda vez que é aberto/atualizado — se a leitura estiver
// velha, ela é refeita na hora (ver cafeESPrecisaAtualizar).

import { getConfig, setConfig } from "@/lib/config";
import { llmTexto, iaHabilitada } from "@/lib/ai";

const CHAVE_HISTORICO = "cafe.es.historico";
const CHAVE_ULTIMO = "cafe.es.ultimo";
const CHAVE_TENTATIVA = "cafe.es.tentativaEm";
const TIMEOUT_MS = 12_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Leitura vale por 15 min (o preço é diário, mas o vendedor quer ver
// atualizado sempre que abre); depois de uma falha, espera 10 min para
// tentar de novo (não gasta IA à toa).
const VALIDADE_MS = 15 * 60_000;
const ESPERA_APOS_FALHA_MS = 10 * 60_000;

export type CotacaoCafeES = {
  conilon: number | null;      // R$/saca 60 kg
  arabica: number | null;      // R$/saca 60 kg
  dataReferencia: string | null; // dd/mm/aaaa da fonte
  fonte: string | null;
  praca?: string | null;       // praça/região do preço (ex.: "Vitória - ES")
  atualizadoEm: string;        // ISO da leitura
  variacaoConilonPct: number | null; // vs. leitura anterior gravada
};

export type PontoHistoricoCafe = { data: string; conilon: number | null; arabica: number | null; fonte: string | null };

type Leitura = { conilon: number | null; arabica: number | null; dataReferencia: string | null; fonte: string; praca?: string | null };

const numBR = (s: string): number | null => {
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 100 && n < 20000 ? n : null;
};
const valido = (n: unknown): number | null => (typeof n === "number" && Number.isFinite(n) && n > 100 && n < 20000 ? Math.round(n * 100) / 100 : null);

async function baixar(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*", "Accept-Language": "pt-BR,pt;q=0.9" }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// HTML → texto corrido, sem scripts/estilos/tags.
function htmlParaTexto(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

// Só os trechos em volta das palavras que interessam (cabe no prompt da IA).
function trechosRelevantes(texto: string, max = 9000): string {
  const rx = /conilon|con[ií]lon|robusta|ar[áa]bica|esp[íi]rito santo|vit[óo]ria|colatina|s[ãa]o gabriel|linhares|nova ven[ée]cia|saca/gi;
  const partes: string[] = [];
  const vistos: [number, number][] = [];
  for (const m of texto.matchAll(rx)) {
    const ini = Math.max(0, m.index! - 350), fim = Math.min(texto.length, m.index! + 450);
    if (vistos.some(([a, b]) => ini >= a && fim <= b)) continue;
    vistos.push([ini, fim]);
    partes.push(texto.slice(ini, fim));
    if (partes.join("\n…\n").length > max) break;
  }
  const junto = partes.join("\n…\n");
  return (junto || texto).slice(0, max);
}

// Leitura direta: "Conilon … R$ 1.234,56" ou "dd/mm/aaaa … 1.234,56".
function lerDireto(texto: string, rotulo: RegExp): { valor: number; data: string | null } | null {
  const i = texto.search(rotulo);
  if (i < 0) return null;
  const janela = texto.slice(i, i + 600);
  const comRS = janela.match(/R\$\s*([\d.]{1,7},\d{2})/);
  const data = janela.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] ?? texto.slice(Math.max(0, i - 300), i + 600).match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] ?? null;
  if (comRS) { const v = numBR(comRS[1]); if (v) return { valor: v, data }; }
  const soNumero = janela.match(/(?:^|\s)([\d.]{1,7},\d{2})(?=\s|$)/);
  if (soNumero) { const v = numBR(soNumero[1]); if (v) return { valor: v, data }; }
  return null;
}

// A IA lê o texto da página e devolve o preço. É o que garante a leitura do
// Painel do Café mesmo que o layout do site mude.
async function extrairPorIA(texto: string, fonte: string): Promise<Leitura | null> {
  if (!iaHabilitada() || texto.length < 40) return null;
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const system = `Você lê o texto bruto de um site de cotações de café (${fonte}) e extrai preços da SACA DE 60 KG em reais.
Hoje é ${hoje}. Devolva SOMENTE um JSON válido:
{
  "conilon": number|null,        // preço do café CONILON (robusta) no Espírito Santo, R$/saca 60 kg. Prefira a praça de Vitória/Colatina/ES ou o indicador CEPEA/ESALQ do conilon ES. Ex.: 1234.5
  "arabica": number|null,        // preço do café ARÁBICA (bebida dura, tipo 6/7, ou indicador CEPEA), R$/saca 60 kg
  "dataReferencia": "dd/mm/aaaa"|null, // data a que o preço se refere
  "praca": string|null           // praça/região do preço do conilon, como no texto (ex.: "Vitória - ES")
}
Regras: use só o que está no texto; não invente; se houver vários valores de conilon, prefira o mais recente e do ES; se o preço estiver em outra unidade (ex.: por arroba ou por kg), NÃO converta — devolva null. Números como número (ponto decimal), sem "R$".`;
  try {
    const raw = await llmTexto(system, texto, { maxTokens: 300, json: true });
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const p = JSON.parse(json) as { conilon?: unknown; arabica?: unknown; dataReferencia?: unknown; praca?: unknown };
    const conilon = valido(p.conilon), arabica = valido(p.arabica);
    if (!conilon && !arabica) return null;
    return {
      conilon, arabica,
      dataReferencia: typeof p.dataReferencia === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(p.dataReferencia) ? p.dataReferencia : null,
      fonte: `${fonte} (IA)`,
      praca: typeof p.praca === "string" && p.praca.trim() ? p.praca.trim().slice(0, 60) : null,
    };
  } catch {
    return null;
  }
}

async function lerFonte(url: string, fonte: string, rotuloConilon: RegExp, rotuloArabica: RegExp | null): Promise<Leitura | null> {
  const html = await baixar(url);
  if (!html) return null;
  const texto = htmlParaTexto(html);
  const c = lerDireto(texto, rotuloConilon);
  const a = rotuloArabica ? lerDireto(texto, rotuloArabica) : null;
  if (c) return { conilon: c.valor, arabica: a?.valor ?? null, dataReferencia: c.data ?? a?.data ?? null, fonte };
  return extrairPorIA(trechosRelevantes(texto), fonte);
}

const fontePainelDoCafe = () => lerFonte("https://www.paineldocafe.com.br/", "Painel do Café", /conilon[^\n]{0,80}(vit[óo]ria|es\b|esp[íi]rito)|conilon/i, /ar[áa]bica/i);
const fonteCepea = () => lerFonte("https://www.cepea.esalq.usp.br/br/indicador/cafe.aspx", "CEPEA/ESALQ", /robusta|conilon/i, /ar[áa]bica/i);
const fonteNoticiasAgricolas = () => lerFonte("https://www.noticiasagricolas.com.br/cotacoes/cafe/cafe-conilon-cepea-esalq", "Notícias Agrícolas (CEPEA)", /conilon/i, null);
const fonteCCCV = () => lerFonte("https://www.cccv.org.br/cotacao/", "CCCV", /conilon/i, /ar[áa]bica/i);

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

// A leitura está velha (ou nunca houve) e já passou a espera após a última
// tentativa? Usado pela rota do letreiro para atualizar ao abrir o CRM.
export async function cafeESPrecisaAtualizar(): Promise<boolean> {
  const [ultimo, tentativa] = await Promise.all([lerCafeES(), getConfig(CHAVE_TENTATIVA).catch(() => null)]);
  const agora = Date.now();
  if (ultimo && agora - new Date(ultimo.atualizadoEm).getTime() < VALIDADE_MS) return false;
  if (tentativa && agora - new Date(tentativa).getTime() < ESPERA_APOS_FALHA_MS) return false;
  return true;
}

// Tenta as fontes em ordem; grava e devolve o resultado.
export async function atualizarCafeES(): Promise<{ ok: boolean; fonte: string | null; conilon: number | null }> {
  await setConfig(CHAVE_TENTATIVA, new Date().toISOString()).catch(() => {});
  const anterior = await lerCafeES();
  const fontes = [fontePainelDoCafe, fonteCepea, fonteNoticiasAgricolas, fonteCCCV];
  let achado: Leitura | null = null;
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
    fonte: achado.fonte,
    praca: achado.praca ?? null,
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
