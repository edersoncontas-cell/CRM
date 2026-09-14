import { getConfig, setConfig } from "@/lib/config";

// Cotações do letreiro do Dashboard — AUTOMÁTICAS, sem chave de API:
//   • Dólar (USD/BRL): AwesomeAPI (pública).
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
};

let cacheMem: { em: number; dados: CotacoesMercado } | null = null;

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function buscarDolar(): Promise<Cotacao | null> {
  try {
    const data = (await fetchJson("https://economia.awesomeapi.com.br/json/last/USD-BRL")) as { USDBRL?: { bid?: string; pctChange?: string } };
    const valor = parseFloat(data?.USDBRL?.bid ?? "");
    if (!Number.isFinite(valor)) return null;
    const pct = parseFloat(data?.USDBRL?.pctChange ?? "");
    return { valor, variacaoPct: Number.isFinite(pct) ? pct : null, bruto: null, unidadeBruta: null };
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

export async function obterCotacoes(): Promise<CotacoesMercado> {
  if (cacheMem && Date.now() - cacheMem.em < CACHE_MS) return cacheMem.dados;

  const [dolar, kc, rc] = await Promise.all([buscarDolar(), buscarFuturo("KC=F"), buscarFuturo("RC=F")]);

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

  cacheMem = { em: Date.now(), dados };
  return dados;
}

// Reserva manual (Configurações) — usada só se a cotação automática falhar.
export async function atualizarCotacaoCafe(arabica: number | null, conilon: number | null): Promise<void> {
  if (arabica != null) await setConfig(CHAVE_ARABICA, String(arabica));
  if (conilon != null) await setConfig(CHAVE_CONILON, String(conilon));
  await setConfig(CHAVE_ATUALIZADO_EM, new Date().toISOString());
  cacheMem = null;
}
