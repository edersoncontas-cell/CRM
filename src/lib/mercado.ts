import { getConfig, setConfig } from "@/lib/config";

// Cotações do letreiro do Dashboard. O dólar é buscado ao vivo (API pública,
// sem chave); café arábica/conilon não tem API gratuita confiável — fica
// como valor manual, atualizado em Configurações (mesmo padrão de chave/valor
// já usado no resto do CRM).
const CHAVE_ARABICA = "cotacao_cafe_arabica";
const CHAVE_CONILON = "cotacao_cafe_conilon";
const CHAVE_ATUALIZADO_EM = "cotacao_cafe_atualizado_em";

export type CotacoesMercado = {
  dolar: number | null;
  cafeArabica: number | null;
  cafeConilon: number | null;
  cafeAtualizadoEm: string | null;
};

async function buscarDolar(): Promise<number | null> {
  try {
    const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const valor = parseFloat(data?.USDBRL?.bid);
    return Number.isFinite(valor) ? valor : null;
  } catch {
    return null;
  }
}

export async function obterCotacoes(): Promise<CotacoesMercado> {
  const [dolar, arabica, conilon, atualizadoEm] = await Promise.all([
    buscarDolar(),
    getConfig(CHAVE_ARABICA),
    getConfig(CHAVE_CONILON),
    getConfig(CHAVE_ATUALIZADO_EM),
  ]);
  return {
    dolar,
    cafeArabica: arabica ? parseFloat(arabica) : null,
    cafeConilon: conilon ? parseFloat(conilon) : null,
    cafeAtualizadoEm: atualizadoEm,
  };
}

export async function atualizarCotacaoCafe(arabica: number | null, conilon: number | null): Promise<void> {
  if (arabica != null) await setConfig(CHAVE_ARABICA, String(arabica));
  if (conilon != null) await setConfig(CHAVE_CONILON, String(conilon));
  await setConfig(CHAVE_ATUALIZADO_EM, new Date().toISOString());
}
