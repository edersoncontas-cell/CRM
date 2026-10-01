// "O indicador do café arábica está travado em zero %" (01/10) — o caminho
// inteiro do robô do café, com as fontes simuladas (sem rede aqui): a fonte
// que respondeu só tinha conilon, e o arábica de 23/09 era repetido e
// comparado com ele mesmo.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cotacoesDaFita } from "@/lib/ticker-fita";
import type { CotacoesMercado } from "@/lib/mercado";

const banco = new Map<string, string>();
vi.mock("@/lib/config", () => ({
  getConfig: async (k: string) => banco.get(k) ?? null,
  setConfig: async (k: string, v: string) => { banco.set(k, v); },
}));
vi.mock("@/lib/ai", () => ({ iaHabilitada: () => false, llmTexto: async () => "" }));

// O que cada fonte responde nesta rodada (null = fora do ar).
let painel: unknown = null;
let noticias: string | null = null;
function fontes() {
  vi.stubGlobal("fetch", async (url: string) => {
    const corpo = url.includes("coffee-panel") ? (painel ? JSON.stringify(painel) : null)
      : url.includes("noticiasagricolas") ? noticias
      : null;
    if (corpo == null) return new Response("fora do ar", { status: 503 });
    return new Response(corpo, { status: 200 });
  });
}

const NOTICIAS_SO_CONILON = "<table><tr><th>Data</th><th>Valor</th></tr><tr><td>01/10/2026</td><td>985,47</td></tr></table>";
const PAINEL_COM_ARABICA = {
  stocks: [{ name: "DÓLAR", symbol: "USD", change: 0.4, last_update: "2026-10-01 11:00:00", price: 5.22, type: "currency" }],
  values: [{ name: "Conilon 7/8", value: 990.1 }, { name: "Arábica RIO", value: 1210.5 }],
};

const mercado = (cafeES: CotacoesMercado["cafeES"]): CotacoesMercado => ({
  dolar: 5.22, cafeArabica: 1996.35, cafeConilon: null, cafeAtualizadoEm: null,
  detalhe: { dolar: null, arabica: { variacaoPct: 1.2 } as never, conilon: null }, fonte: "mercado", cafeES,
});

async function rodar(iso: string) {
  vi.setSystemTime(new Date(iso));
  vi.resetModules();
  const m = await import("@/lib/cafe-es");
  const r = await m.atualizarCafeES();
  return { r, es: await m.lerCafeES(), hist: await m.lerHistoricoCafeES() };
}

beforeEach(() => {
  banco.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  painel = null;
  noticias = null;
  fontes();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("robô do café: arábica que a fonte da vez não trouxe", () => {
  it("o caso dele: o 1.155,00 de 23/09 não é mais repetido — o letreiro passa para o Arábica NY, com variação", async () => {
    banco.set("cafe.es.ultimo", JSON.stringify({
      conilon: 940, arabica: 1155, dataReferencia: "23/09/2026", fonte: "CCCV (Vitória)", atualizadoEm: "2026-09-23T14:00:00Z",
      variacaoConilonPct: 0.2, variacaoArabicaPct: 0,
    }));
    banco.set("cafe.es.historico", JSON.stringify([{ data: "23/09/2026", conilon: 940, arabica: 1155, fonte: "CCCV (Vitória)" }]));
    noticias = NOTICIAS_SO_CONILON;

    const { r, es, hist } = await rodar("2026-10-01T15:00:00Z");
    expect(r).toMatchObject({ ok: true, conilon: 985.47 });
    expect(es?.arabica).toBeNull();
    expect(es?.variacaoArabicaPct).toBeNull();
    expect(hist.find((h) => h.data === "01/10/2026")?.arabica).toBeNull();

    const fita = cotacoesDaFita(mercado(es));
    expect(fita[0]).toMatchObject({ rotulo: "Arábica NY", pct: 1.2 });
    expect(fita[1]).toMatchObject({ rotulo: "Conilon ES", valor: "R$ 985,47" });
  });

  it("arábica lido de manhã no Painel: à tarde, com só o conilon respondendo, continua com a variação da manhã", async () => {
    banco.set("cafe.es.historico", JSON.stringify([{ data: "30/09/2026", conilon: 980, arabica: 1200, fonte: "Painel do Café" }]));
    painel = PAINEL_COM_ARABICA;
    const manha = await rodar("2026-10-01T12:00:00Z");
    expect(manha.es).toMatchObject({ arabica: 1210.5, variacaoArabicaPct: 0.88, arabicaLidaEm: "2026-10-01T12:00:00.000Z" });

    painel = null;
    noticias = NOTICIAS_SO_CONILON;
    const tarde = await rodar("2026-10-01T15:00:00Z");
    expect(tarde.es).toMatchObject({ arabica: 1210.5, variacaoArabicaPct: 0.88, arabicaLidaEm: "2026-10-01T12:00:00.000Z", conilon: 985.47 });
    // O ponto de hoje no histórico guarda o arábica lido de manhã.
    expect(tarde.hist.find((h) => h.data === "01/10/2026")?.arabica).toBe(1210.5);
    expect(cotacoesDaFita(mercado(tarde.es))[0]).toMatchObject({ rotulo: "Arábica ES", valor: "R$ 1.210,50", pct: 0.88 });

    // De noite, mais de 6 h depois: para de repetir.
    const noite = await rodar("2026-10-01T18:30:00Z");
    expect(noite.es?.arabica).toBeNull();
    expect(cotacoesDaFita(mercado(noite.es))[0]).toMatchObject({ rotulo: "Arábica NY" });
  });
});
