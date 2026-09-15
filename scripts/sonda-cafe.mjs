// Sonda do robô do café: baixa as fontes de cotação e mostra o que o servidor
// enxerga (texto em volta de "conilon"/"arábica", endpoints JSON, bundles).
// Roda no GitHub Actions (workflow "Sonda café") para diagnosticar a leitura
// sem depender de ambiente com rede restrita. Só imprime; não grava nada.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function baixar(url, accept = "text/html,*/*") {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "pt-BR,pt;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    const corpo = await res.text();
    console.log(`\n=== GET ${url} → ${res.status} ${res.headers.get("content-type")} · ${corpo.length} bytes · ${Date.now() - t0} ms`);
    return { ok: res.ok, corpo, tipo: res.headers.get("content-type") ?? "" };
  } catch (e) {
    console.log(`\n=== GET ${url} → ERRO ${e instanceof Error ? e.message : e}`);
    return { ok: false, corpo: "", tipo: "" };
  }
}

const texto = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d|td|th)>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

function janelas(t, rx, tam = 300, max = 8) {
  let n = 0;
  for (const m of t.matchAll(rx)) {
    console.log(`--- [${m[0]}] @${m.index}:\n${t.slice(Math.max(0, m.index - tam), m.index + tam).replace(/\n/g, " ⏎ ")}`);
    if (++n >= max) break;
  }
  if (!n) console.log(`--- (nenhuma ocorrência de ${rx})`);
}

const painel = await baixar("https://www.paineldocafe.com.br/");
if (painel.corpo) {
  const t = texto(painel.corpo);
  console.log("\n### TEXTO (primeiros 2500):\n" + t.slice(0, 2500));
  console.log("\n### JANELAS conilon/arábica/dólar:");
  janelas(t, /conilon|ar[áa]bica|d[óo]lar|londres|york/gi);
  console.log("\n### URLs no HTML (api/json/cotac/painel/js):");
  const urls = new Set();
  for (const m of painel.corpo.matchAll(/(?:https?:)?\/\/[^"'\s<>)]+|(?:src|href|action)=["']([^"']+)["']/gi)) {
    const u = m[1] ?? m[0];
    if (/api|json|cotac|painel|\.js(\?|$)|fetch|graphql|wp-json|data/i.test(u)) urls.add(u);
  }
  for (const u of Array.from(urls).slice(0, 40)) console.log("  ", u);
  console.log("\n### TRECHOS DE SCRIPT INLINE com conilon/cotac/fetch (até 6):");
  let n = 0;
  for (const m of painel.corpo.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
    const s = m[1];
    if (/conilon|cotac|fetch\(|axios|\.json\(/i.test(s)) { console.log("---\n" + s.slice(0, 1500)); if (++n >= 6) break; }
  }
  // Bundles JS externos: procura endpoints e a palavra conilon.
  const scripts = Array.from(painel.corpo.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)).map((m) => m[1]).slice(0, 6);
  for (let src of scripts) {
    if (src.startsWith("//")) src = "https:" + src; else if (src.startsWith("/")) src = "https://www.paineldocafe.com.br" + src; else if (!/^https?:/.test(src)) src = "https://www.paineldocafe.com.br/" + src;
    const js = await baixar(src, "*/*");
    if (!js.corpo) continue;
    const hits = Array.from(js.corpo.matchAll(/["'`](\/?[^"'`\s]{3,120}?(?:api|json|cotac|conilon|painel)[^"'`\s]{0,120})["'`]/gi)).map((m) => m[1]);
    console.log("   endpoints/palavras:", Array.from(new Set(hits)).slice(0, 30));
    janelas(js.corpo, /conilon/gi, 200, 3);
  }
  // Tentativas diretas de endpoints comuns.
  for (const u of ["https://www.paineldocafe.com.br/api/cotacoes", "https://www.paineldocafe.com.br/api/cotacao", "https://www.paineldocafe.com.br/cotacao", "https://www.paineldocafe.com.br/cotacoes", "https://www.paineldocafe.com.br/api/indicadores", "https://www.paineldocafe.com.br/wp-json/wp/v2/posts?per_page=1"]) {
    const r = await baixar(u, "application/json,text/html,*/*");
    if (r.corpo) console.log(r.corpo.slice(0, 800));
  }
}

for (const u of ["https://www.cepea.esalq.usp.br/br/indicador/cafe.aspx", "https://www.cccv.org.br/cotacao/", "https://www.noticiasagricolas.com.br/cotacoes/cafe/cafe-conilon-cepea-esalq"]) {
  const r = await baixar(u);
  if (!r.corpo) continue;
  const t = texto(r.corpo);
  console.log("### JANELAS:");
  janelas(t, /robusta|conilon|ar[áa]bica/gi, 250, 4);
}
