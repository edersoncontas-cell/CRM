// Robô da cotação do café no Espírito Santo. Busca o preço da saca de conilon
// (e do arábica) em fontes públicas, na ordem:
//   1. Painel do Café — a API do aplicativo (paineldocafe.com.br), a fonte
//      pedida pelo vendedor: Conilon 7/8, Arábica Rio, dólar, Londres, NY
//   2. CCCV — Centro do Comércio de Café de Vitória (tabela do mês)
//   3. Notícias Agrícolas — indicador CEPEA/ESALQ do conilon ES
//   4. CEPEA/ESALQ direto (costuma bloquear robô; fica por último)
// Cada fonte tem leitura direta (parser em lib/cafe-parsers.ts) e, se não
// achar, a IA extrai o preço do texto da página. Grava histórico diário em
// Configuracao (cafe.es.historico) e o último valor bom (cafe.es.ultimo).
//
// Quem chama: o cron /api/cron/mercado E a rota /api/mercado/ticker, que o
// Dashboard consulta toda vez que é aberto/atualizado — se a leitura estiver
// velha, ela é refeita na hora (ver cafeESPrecisaAtualizar).

import { getConfig, setConfig } from "@/lib/config";
import { llmTexto, iaHabilitada } from "@/lib/ai";
import { htmlParaTexto, trechosRelevantes, lerDireto, lerTabelaCCCV, lerNoticiasAgricolasConilon, lerJsonPainelDoCafe, valido, type Leitura } from "@/lib/cafe-parsers";

const CHAVE_HISTORICO = "cafe.es.historico";
const CHAVE_ULTIMO = "cafe.es.ultimo";
const CHAVE_TENTATIVA = "cafe.es.tentativaEm";
const TIMEOUT_MS = 12_000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const API_PAINEL = "https://api.coffee-panel.mitrix.online/api/home/information";

// Leitura da API do Painel do Café é barata: vale por 1 min (o letreiro
// consulta a cada minuto). Leituras das reservas (páginas HTML, às vezes com
// IA) valem por 15 min; depois de uma falha, espera 10 min para tentar de
// novo (não gasta IA à toa).
const VALIDADE_PAINEL_MS = 60_000;
const VALIDADE_RESERVA_MS = 15 * 60_000;
const ESPERA_APOS_FALHA_MS = 10 * 60_000;

export type CotacaoCafeES = {
  conilon: number | null;      // R$/saca 60 kg
  arabica: number | null;      // R$/saca 60 kg
  dataReferencia: string | null; // dd/mm/aaaa da fonte
  fonte: string | null;
  praca?: string | null;       // praça/região do preço (ex.: "Vitória - ES")
  atualizadoEm: string;        // ISO da leitura
  variacaoConilonPct: number | null; // da fonte ou vs. leitura anterior gravada
  variacaoArabicaPct?: number | null;
  // Extras do Painel do Café
  dolar?: number | null;
  londres?: number | null;
  novaYork?: number | null;
};

export type PontoHistoricoCafe = { data: string; conilon: number | null; arabica: number | null; fonte: string | null };

async function baixar(url: string, accept = "text/html,*/*"): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "pt-BR,pt;q=0.9" }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// A IA lê o texto da página e devolve o preço (reserva para quando a leitura
// direta não encontra a tabela).
async function extrairPorIA(texto: string, fonte: string): Promise<Leitura | null> {
  if (!iaHabilitada() || texto.length < 40) return null;
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const system = `Você lê o texto bruto de um site de cotações de café (${fonte}) e extrai preços da SACA DE 60 KG em reais.
Hoje é ${hoje}. Devolva SOMENTE um JSON válido:
{
  "conilon": number|null,        // preço do café CONILON (robusta) no Espírito Santo, R$/saca 60 kg. Prefira a praça de Vitória/ES ou o indicador CEPEA/ESALQ do conilon ES. Ex.: 980.78
  "arabica": number|null,        // preço do café ARÁBICA (bebida rio/dura ou indicador CEPEA), R$/saca 60 kg
  "dataReferencia": "dd/mm/aaaa"|null, // data a que o preço se refere
  "praca": string|null           // praça/região do preço do conilon, como no texto (ex.: "Vitória - ES")
}
Regras: use só o que está no texto; não invente; se houver vários valores de conilon, prefira o mais recente e do ES; se o preço estiver em outra unidade (arroba, kg), NÃO converta — devolva null. Números como número (ponto decimal), sem "R$".`;
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

// 1) Painel do Café: JSON da API do app.
async function fontePainelDoCafe(): Promise<Leitura | null> {
  const corpo = await baixar(API_PAINEL, "application/json");
  if (!corpo) return null;
  try {
    return lerJsonPainelDoCafe(JSON.parse(corpo));
  } catch {
    return null;
  }
}

// 2) CCCV: tabela do mês.
async function fonteCCCV(): Promise<Leitura | null> {
  const html = await baixar("https://www.cccv.org.br/cotacao/");
  if (!html) return null;
  const texto = htmlParaTexto(html);
  return lerTabelaCCCV(texto) ?? extrairPorIA(trechosRelevantes(texto), "CCCV");
}

// 3) Notícias Agrícolas: indicador CEPEA/ESALQ do conilon.
async function fonteNoticiasAgricolas(): Promise<Leitura | null> {
  const html = await baixar("https://www.noticiasagricolas.com.br/cotacoes/cafe/indicador-cepea-esalq-cafe-conillon");
  if (!html) return null;
  const texto = htmlParaTexto(html);
  return lerNoticiasAgricolasConilon(texto) ?? extrairPorIA(trechosRelevantes(texto), "Notícias Agrícolas");
}

// 4) CEPEA direto (leitura genérica; o site costuma responder 403 a robôs).
async function fonteCepea(): Promise<Leitura | null> {
  const html = await baixar("https://www.cepea.esalq.usp.br/br/indicador/cafe.aspx");
  if (!html) return null;
  const texto = htmlParaTexto(html);
  const c = lerDireto(texto, /robusta|conilon/i);
  const a = lerDireto(texto, /ar[áa]bica/i);
  if (c) return { conilon: c.valor, arabica: a?.valor ?? null, dataReferencia: c.data ?? a?.data ?? null, fonte: "CEPEA/ESALQ" };
  return extrairPorIA(trechosRelevantes(texto), "CEPEA/ESALQ");
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

// A leitura está velha (ou nunca houve) e já passou a espera após a última
// tentativa? Usado pela rota do letreiro para atualizar ao abrir o CRM.
export async function cafeESPrecisaAtualizar(): Promise<boolean> {
  const [ultimo, tentativa] = await Promise.all([lerCafeES(), getConfig(CHAVE_TENTATIVA).catch(() => null)]);
  const agora = Date.now();
  const validade = (ultimo?.fonte ?? "").startsWith("Painel do Café") ? VALIDADE_PAINEL_MS : VALIDADE_RESERVA_MS;
  if (ultimo && agora - new Date(ultimo.atualizadoEm).getTime() < validade) return false;
  if (tentativa && agora - new Date(tentativa).getTime() < ESPERA_APOS_FALHA_MS) return false;
  return true;
}

// Variação (%) contra o último dia DIFERENTE do histórico — assim ela não
// zera quando a mesma cotação é relida a cada minuto.
function variacaoContraDiaAnterior(hist: PontoHistoricoCafe[], chaveHoje: string, campo: "conilon" | "arabica", valorHoje: number | null): number | null {
  if (valorHoje == null) return null;
  const anterior = [...hist].reverse().find((h) => h.data !== chaveHoje && h[campo] != null);
  if (!anterior || !anterior[campo]) return null;
  const v = ((valorHoje - anterior[campo]!) / anterior[campo]!) * 100;
  return Math.abs(v) < 25 ? Math.round(v * 100) / 100 : null;
}

// Tenta as fontes em ordem; grava e devolve o resultado.
export async function atualizarCafeES(): Promise<{ ok: boolean; fonte: string | null; conilon: number | null }> {
  await setConfig(CHAVE_TENTATIVA, new Date().toISOString()).catch(() => {});
  const anterior = await lerCafeES();
  const fontes = [fontePainelDoCafe, fonteCCCV, fonteNoticiasAgricolas, fonteCepea];
  let achado: Leitura | null = null;
  for (const f of fontes) {
    achado = await f().catch(() => null);
    if (achado?.conilon) break;
  }
  if (!achado?.conilon) return { ok: false, fonte: null, conilon: anterior?.conilon ?? null };

  // Histórico: um ponto por data de referência (ou por dia de leitura).
  const hist = await lerHistoricoCafeES();
  const chave = achado.dataReferencia ?? new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const arabica = achado.arabica ?? anterior?.arabica ?? null;
  const novo: CotacaoCafeES = {
    conilon: achado.conilon,
    arabica,
    dataReferencia: achado.dataReferencia ?? null,
    fonte: achado.fonte,
    praca: achado.praca ?? null,
    atualizadoEm: new Date().toISOString(),
    variacaoConilonPct: achado.variacaoConilonPct ?? variacaoContraDiaAnterior(hist, chave, "conilon", achado.conilon),
    variacaoArabicaPct: achado.variacaoArabicaPct ?? variacaoContraDiaAnterior(hist, chave, "arabica", arabica),
    dolar: achado.dolar ?? null,
    londres: achado.londres ?? null,
    novaYork: achado.novaYork ?? null,
  };
  await setConfig(CHAVE_ULTIMO, JSON.stringify(novo));
  const semDup = hist.filter((h) => h.data !== chave);
  semDup.push({ data: chave, conilon: novo.conilon, arabica: novo.arabica, fonte: novo.fonte });
  await setConfig(CHAVE_HISTORICO, JSON.stringify(semDup.slice(-400)));
  return { ok: true, fonte: novo.fonte, conilon: novo.conilon };
}
