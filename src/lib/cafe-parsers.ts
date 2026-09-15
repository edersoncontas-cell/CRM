// Leitores puros das fontes de cotação do café (sem banco, sem IA) — assim
// dá para testar com texto fixo. Usados por lib/cafe-es.ts.

export type Leitura = {
  conilon: number | null;        // R$/saca 60 kg
  arabica: number | null;        // R$/saca 60 kg
  dataReferencia: string | null; // dd/mm/aaaa
  fonte: string;
  praca?: string | null;
  // Extras do Painel do Café (bolsa e dólar do dia), quando existirem.
  dolar?: number | null;
  londres?: number | null;       // US$/t
  novaYork?: number | null;      // ¢/lb
  variacaoConilonPct?: number | null;
  variacaoArabicaPct?: number | null;
};

// "1.234,56" → 1234.56 (só aceita valores plausíveis de saca).
export const numBR = (s: string): number | null => {
  const n = parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 100 && n < 20000 ? n : null;
};
export const valido = (n: unknown): number | null => (typeof n === "number" && Number.isFinite(n) && n > 100 && n < 20000 ? Math.round(n * 100) / 100 : null);

// Número vindo de JSON: aceita 980.78, "980.78", "980,78" ou "1.211,59".
export function numJson(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim().replace(/[^\d.,-]/g, "");
  const n = /,\d{1,2}$/.test(s) ? parseFloat(s.replace(/\./g, "").replace(",", ".")) : parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// HTML → texto corrido, sem scripts/estilos/tags.
export function htmlParaTexto(html: string): string {
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
export function trechosRelevantes(texto: string, max = 9000): string {
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

// Leitura direta genérica: "Conilon … R$ 1.234,56" ou "dd/mm/aaaa … 1.234,56".
export function lerDireto(texto: string, rotulo: RegExp): { valor: number; data: string | null } | null {
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

// CCCV (Centro do Comércio de Café de Vitória): tabela do mês com uma linha
// por dia e três colunas — arábica "dura", arábica "rio" e conilon tipo 7/8.
// Pega a última linha cotada (dias sem pregão vêm com "-").
const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export function lerTabelaCCCV(texto: string): Leitura | null {
  const titulo = texto.match(/referente ao m[êe]s de\s+([A-Za-zçÇ]+)\s+de\s+(\d{4})/i);
  const mes = titulo ? MESES_PT.indexOf(titulo[1].toLowerCase()) + 1 : 0;
  const ano = titulo ? Number(titulo[2]) : 0;
  const rx = /(?:^|\n)\s*(\d{1,2})\s*\n\s*([\d.]{1,7},\d{2})\s*\n\s*([\d.]{1,7},\d{2})\s*\n\s*([\d.]{1,7},\d{2})/g;
  let ultima: { dia: number; dura: number | null; rio: number | null; conilon: number | null } | null = null;
  for (const m of texto.matchAll(rx)) {
    const dia = Number(m[1]);
    if (dia < 1 || dia > 31) continue;
    ultima = { dia, dura: numBR(m[2]), rio: numBR(m[3]), conilon: numBR(m[4]) };
  }
  if (!ultima?.conilon) return null;
  const data = mes && ano ? `${String(ultima.dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}` : null;
  return { conilon: ultima.conilon, arabica: ultima.rio ?? ultima.dura, dataReferencia: data, fonte: "CCCV (Vitória)", praca: "Vitória - ES" };
}

// Notícias Agrícolas — página do indicador CEPEA/ESALQ do conilon (ES):
// tabela "Data ⏎ Valor ⏎ Variação", a primeira linha é a mais recente.
export function lerNoticiasAgricolasConilon(texto: string): Leitura | null {
  const m = texto.match(/(\d{2}\/\d{2}\/\d{4})\s*\n\s*([\d.]{1,7},\d{2})/);
  const valor = m ? numBR(m[2]) : null;
  if (!valor) return null;
  return { conilon: valor, arabica: null, dataReferencia: m![1], fonte: "CEPEA/ESALQ (Notícias Agrícolas)", praca: "Espírito Santo" };
}

// Painel do Café — JSON da API do aplicativo. Procura, em qualquer nível do
// objeto, os indicadores "Conilon 7/8" e "Arábica Rio" (mais dólar, Londres e
// Nova York) pelo NOME, sem depender do formato exato das chaves.
export function lerJsonPainelDoCafe(json: unknown): Leitura | null {
  const achados: { nome: string; valor: number; variacao: number | null; data: string | null }[] = [];
  const CHAVES_VALOR = ["value", "valor", "price", "preco", "preço", "cotacao", "cotação", "current", "atual", "amount"];
  const CHAVES_VAR = ["variation", "variacao", "variação", "change", "percent", "percentual", "pct"];
  const CHAVES_DATA = ["last_update", "date", "data", "reference", "referencia", "updated_at", "atualizado"];
  const CHAVES_NOME = ["name", "nome", "title", "titulo", "label", "description", "descricao", "type", "tipo", "key", "slug"];
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const pega = (o: Record<string, unknown>, lista: string[]) => { for (const k of Object.keys(o)) if (lista.includes(norm(k))) return o[k]; return undefined; };

  const visita = (v: unknown, chavePai: string) => {
    if (!v || typeof v !== "object") return;
    if (Array.isArray(v)) { for (const x of v) visita(x, chavePai); return; }
    const o = v as Record<string, unknown>;
    const nomeBruto = pega(o, CHAVES_NOME);
    const nome = typeof nomeBruto === "string" ? nomeBruto : chavePai;
    const valor = numJson(pega(o, CHAVES_VALOR));
    if (nome && valor != null) {
      const variacao = numJson(pega(o, CHAVES_VAR));
      const d = pega(o, CHAVES_DATA);
      let data: string | null = null;
      if (typeof d === "string") {
        const br = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
        const iso = d.match(/(\d{4})-(\d{2})-(\d{2})/);
        data = br ? br[0] : iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : null;
      }
      achados.push({ nome: norm(nome), valor, variacao: variacao ?? null, data });
    }
    // Objeto "chave → número" (ex.: { conilon: 980.78, arabica: 1211.59 })
    for (const [k, x] of Object.entries(o)) {
      const n = numJson(x);
      if (n != null && typeof x !== "object") achados.push({ nome: norm(k), valor: n, variacao: null, data: null });
      else visita(x, k);
    }
  };
  visita(json, "");

  const achar = (rx: RegExp, min: number, max: number) => achados.find((a) => rx.test(a.nome) && a.valor >= min && a.valor <= max) ?? null;
  const conilon = achar(/conilon|conillon|robusta/, 200, 5000);
  const arabica = achar(/arabica/, 300, 8000);
  if (!conilon && !arabica) return null;
  const dolar = achar(/^dolar$|dollar|^usd$/, 2, 12);
  const londres = achar(/londres|london|liffe/, 1000, 10000);
  const ny = achar(/york|^ny$|nova york/, 80, 600);
  // Os indicadores físicos não trazem data; usa a da bolsa/dólar do mesmo JSON.
  const dataReferencia = conilon?.data ?? arabica?.data ?? dolar?.data ?? ny?.data ?? londres?.data ?? null;
  return {
    conilon: conilon?.valor ?? null,
    arabica: arabica?.valor ?? null,
    dataReferencia,
    fonte: "Painel do Café",
    praca: "ES",
    dolar: dolar?.valor ?? null,
    londres: londres?.valor ?? null,
    novaYork: ny?.valor ?? null,
    variacaoConilonPct: conilon?.variacao ?? null,
    variacaoArabicaPct: arabica?.variacao ?? null,
  };
}
