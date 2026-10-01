import { getConfig, setConfig } from "@/lib/config";
import { lerCafeES, type CotacaoCafeES } from "@/lib/cafe-es";

// Cotações do letreiro do Dashboard — AUTOMÁTICAS, sem chave de API:
//   • Dólar (USD/BRL): AwesomeAPI (pública); se ela não responder, o par
//     BRL=X do Yahoo. O último dólar bom fica guardado (cotacao_dolar_ultimo):
//     sem isso, um dia de AwesomeAPI fora tirava o dólar do letreiro, e o
//     rodízio das cotações repetia o café no lugar dele.
//   • Café arábica: contrato "Coffee C" da bolsa de Nova York (KC=F, ¢/lb).
//   • Café conilon/robusta: contrato de Londres (RC=F, US$/tonelada).
//   Os dois via Yahoo Finance (endpoint público de gráfico) e convertidos
//   para R$/saca de 60 kg pelo dólar do momento — preço de MERCADO (bolsa),
//   que acompanha o dia em tempo real. O indicador físico CEPEA/ESALQ (diário)
//   não tem API gratuita; os valores manuais de Configurações continuam como
//   RESERVA, usados só se a busca automática falhar.
// Cache de 60 s em memória (o letreiro consulta a cada minuto) + último valor
// bom gravado em Configuracao para sobreviver a cold start e a falhas.

const CHAVE_ARABICA = "cotacao_cafe_arabica";
const CHAVE_CONILON = "cotacao_cafe_conilon";
const CHAVE_ATUALIZADO_EM = "cotacao_cafe_atualizado_em";
const CHAVE_ULTIMA_AUTO = "cotacao_auto_ultima";
const CHAVE_DOLAR = "cotacao_dolar_ultimo";

const LB_POR_SACA = 132.277; // 60 kg em libras
const CACHE_MS = 60_000;
const TIMEOUT_MS = 8_000;
const UA = "Mozilla/5.0 (compatible; CRM-NewHolland/1.0)";

export type Cotacao = {
  valor: number;              // já em R$ (dólar em R$; café em R$/saca 60 kg)
  variacaoPct: number | null; // variação do dia (%)
  bruto: number | null;       // valor original na bolsa (¢/lb ou US$/t)
  unidadeBruta: string | null;
};

export type CotacoesMercado = {
  dolar: number | null;
  cafeArabica: number | null;
  cafeConilon: number | null;
  cafeAtualizadoEm: string | null;
  detalhe: { dolar: Cotacao | null; arabica: Cotacao | null; conilon: Cotacao | null };
  fonte: "mercado" | "reserva-manual" | "indisponivel";
  // De onde veio o dólar acima e quando foi lido (pode ser o último bom
  // guardado, se as fontes não responderam agora).
  dolarFonte?: string | null;
  dolarLidoEm?: string | null;
  // Preço físico do conilon no ES (robô lib/cafe-es.ts) — o que o produtor
  // recebe de fato, diferente da bolsa de Londres.
  cafeES?: CotacaoCafeES | null;
};

let cacheMem: { em: number; dados: CotacoesMercado } | null = null;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Reais por dólar dentro do possível. Fora disso é leitura errada, não cotação. */
export function dolarPlausivel(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 2 && v <= 12;
}

export async function buscarDolarAwesome(): Promise<Cotacao | null> {
  try {
    const data = (await fetchJson("https://economia.awesomeapi.com.br/json/last/USD-BRL")) as { USDBRL?: { bid?: string; pctChange?: string } };
    const valor = parseFloat(data?.USDBRL?.bid ?? "");
    if (!dolarPlausivel(valor)) return null;
    const pct = parseFloat(data?.USDBRL?.pctChange ?? "");
    return { valor, variacaoPct: Number.isFinite(pct) ? pct : null, bruto: null, unidadeBruta: null };
  } catch {
    return null;
  }
}

/** Reserva: o par dólar/real no mesmo endpoint do Yahoo que dá o café da bolsa. */
export async function buscarDolarYahoo(): Promise<Cotacao | null> {
  const f = await buscarFuturo("BRL=X");
  if (!f || !dolarPlausivel(f.preco)) return null;
  return { valor: f.preco, variacaoPct: f.variacaoPct, bruto: null, unidadeBruta: null };
}

type DolarGuardado = { cotacao: Cotacao; fonte: string; em: string };

async function buscarDolar(): Promise<DolarGuardado | null> {
  const em = new Date().toISOString();
  const awesome = await buscarDolarAwesome();
  if (awesome) return { cotacao: awesome, fonte: "AwesomeAPI", em };
  const yahoo = await buscarDolarYahoo();
  if (yahoo) return { cotacao: yahoo, fonte: "Yahoo Finance", em };
  return null;
}

async function lerDolarGuardado(): Promise<DolarGuardado | null> {
  try {
    const g = JSON.parse((await getConfig(CHAVE_DOLAR)) ?? "null") as DolarGuardado | null;
    return g && dolarPlausivel(g.cotacao?.valor) ? g : null;
  } catch {
    return null;
  }
}

// Yahoo Finance: preço atual e fechamento anterior de um contrato futuro.
async function buscarFuturo(simbolo: string): Promise<{ preco: number; variacaoPct: number | null } | null> {
  try {
    const data = (await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?range=1d&interval=5m`)) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number } }[] };
    };
    const meta = data?.chart?.result?.[0]?.meta;
    const preco = meta?.regularMarketPrice;
    if (typeof preco !== "number" || !Number.isFinite(preco) || preco <= 0) return null;
    const anterior = meta?.chartPreviousClose ?? meta?.previousClose;
    const variacaoPct = typeof anterior === "number" && anterior > 0 ? ((preco - anterior) / anterior) * 100 : null;
    return { preco, variacaoPct };
  } catch {
    return null;
  }
}

async function lerReservaManual(): Promise<{ arabica: number | null; conilon: number | null; atualizadoEm: string | null }> {
  const [a, c, em] = await Promise.all([getConfig(CHAVE_ARABICA), getConfig(CHAVE_CONILON), getConfig(CHAVE_ATUALIZADO_EM)]);
  return { arabica: a ? parseFloat(a) : null, conilon: c ? parseFloat(c) : null, atualizadoEm: em };
}

// Busca AO VIVO (bolsa + dólar). Chamada pelo cron /api/cron/mercado; as
// telas usam obterCotacoes(), que só lê o que já está gravado.
export async function atualizarCotacoesMercado(): Promise<CotacoesMercado> {

  const [vivo, kc, rc] = await Promise.all([buscarDolar(), buscarFuturo("KC=F"), buscarFuturo("RC=F")]);
  if (vivo) await setConfig(CHAVE_DOLAR, JSON.stringify(vivo)).catch(() => {});
  // Nenhuma fonte do dólar respondeu agora: o último bom serve — o dólar anda
  // pouco num dia, e sem ele nem o café da bolsa sai em reais.
  const lido = vivo ?? (await lerDolarGuardado());
  const dolar = lido?.cotacao ?? null;

  let arabica: Cotacao | null = null;
  let conilon: Cotacao | null = null;
  if (dolar && kc) {
    arabica = { valor: (kc.preco / 100) * LB_POR_SACA * dolar.valor, variacaoPct: kc.variacaoPct, bruto: kc.preco, unidadeBruta: "¢/lb (NY)" };
  }
  if (dolar && rc) {
    conilon = { valor: (rc.preco / 1000) * 60 * dolar.valor, variacaoPct: rc.variacaoPct, bruto: rc.preco, unidadeBruta: "US$/t (Londres)" };
  }

  let dados: CotacoesMercado;
  if (arabica || conilon) {
    dados = {
      dolar: dolar?.valor ?? null,
      cafeArabica: arabica?.valor ?? null,
      cafeConilon: conilon?.valor ?? null,
      cafeAtualizadoEm: new Date().toISOString(),
      detalhe: { dolar, arabica, conilon },
      fonte: "mercado",
    };
    await setConfig(CHAVE_ULTIMA_AUTO, JSON.stringify(dados)).catch(() => {});
  } else {
    // Bolsa indisponível: último valor automático bom; senão, reserva manual.
    let ultima: CotacoesMercado | null = null;
    try { ultima = JSON.parse((await getConfig(CHAVE_ULTIMA_AUTO)) ?? "null"); } catch { ultima = null; }
    if (ultima?.cafeArabica || ultima?.cafeConilon) {
      dados = { ...ultima, dolar: dolar?.valor ?? ultima.dolar, fonte: "mercado" };
    } else {
      const manual = await lerReservaManual();
      dados = {
        dolar: dolar?.valor ?? null,
        cafeArabica: manual.arabica,
        cafeConilon: manual.conilon,
        cafeAtualizadoEm: manual.atualizadoEm,
        detalhe: { dolar, arabica: null, conilon: null },
        fonte: manual.arabica || manual.conilon ? "reserva-manual" : "indisponivel",
      };
    }
  }

  if (lido) {
    dados.dolar = lido.cotacao.valor;
    dados.detalhe = { ...dados.detalhe, dolar: lido.cotacao };
  }
  dados.dolarFonte = lido?.fonte ?? null;
  dados.dolarLidoEm = lido?.em ?? null;
  dados.cafeES = await lerCafeES().catch(() => null);
  cacheMem = { em: Date.now(), dados };
  return dados;
}

// Depois que o robô do café grava uma leitura nova, o cache de 60 s precisa
// ser descartado para o letreiro ver o valor na hora.
export function limparCacheCotacoes(): void {
  cacheMem = null;
}

// Leitura rápida para as telas: cache em memória (60 s) → último valor
// gravado pelo robô → busca ao vivo só se nunca houve leitura (primeiro uso).
export async function obterCotacoes(): Promise<CotacoesMercado> {
  if (cacheMem && Date.now() - cacheMem.em < CACHE_MS) return cacheMem.dados;
  let ultima: CotacoesMercado | null = null;
  const [bruto, dolar] = await Promise.all([getConfig(CHAVE_ULTIMA_AUTO).catch(() => null), lerDolarGuardado()]);
  try { ultima = JSON.parse(bruto ?? "null"); } catch { ultima = null; }
  if (ultima && (ultima.cafeArabica || ultima.cafeConilon || ultima.dolar || dolar)) {
    // O dólar guardado à parte é sempre o mais novo: a leitura da bolsa só é
    // gravada quando o café também veio.
    const dados: CotacoesMercado = {
      ...ultima,
      ...(dolar ? { dolar: dolar.cotacao.valor, detalhe: { ...ultima.detalhe, dolar: dolar.cotacao }, dolarFonte: dolar.fonte, dolarLidoEm: dolar.em } : {}),
      fonte: "mercado",
      cafeES: await lerCafeES().catch(() => null),
    };
    cacheMem = { em: Date.now(), dados };
    return dados;
  }
  return atualizarCotacoesMercado();
}

// Reserva manual (Configurações) — usada só se a cotação automática falhar.
export async function atualizarCotacaoCafe(arabica: number | null, conilon: number | null): Promise<void> {
  if (arabica != null) await setConfig(CHAVE_ARABICA, String(arabica));
  if (conilon != null) await setConfig(CHAVE_CONILON, String(conilon));
  await setConfig(CHAVE_ATUALIZADO_EM, new Date().toISOString());
  cacheMem = null;
}
