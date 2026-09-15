// Sonda do robô do café: baixa as fontes de cotação e mostra o que o servidor
// enxerga (texto, endpoints). Roda no GitHub Actions (workflow "Sonda café")
// para diagnosticar a leitura sem depender de ambiente com rede restrita.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

async function baixar(url, accept = "text/html,*/*", extra = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "pt-BR,pt;q=0.9", ...extra }, redirect: "follow", signal: AbortSignal.timeout(30000) });
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

// 1) Painel do Café: app Flutter. O código compilado (main.dart.js) traz as
//    URLs das APIs que o app consulta.
const base = "https://www.paineldocafe.com.br";
for (const arq of ["/flutter_bootstrap.js", "/main.dart.js", "/manifest.json", "/version.json", "/assets/AssetManifest.json"]) {
  const r = await baixar(base + arq, "*/*");
  if (!r.corpo || !r.ok) continue;
  if (arq.endsWith(".json")) { console.log(r.corpo.slice(0, 1500)); continue; }
  const urls = new Set();
  for (const m of r.corpo.matchAll(/https?:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]{8,200}/g)) {
    const u = m[0];
    if (/google|gstatic|flutter|dart|pub\.dev|w3\.org|apple|facebook|onesignal|gtm|schema\.org|mozilla|unicode|whatwg|github|fonts/i.test(u)) continue;
    urls.add(u);
  }
  console.log(`   URLs (${urls.size}):`); for (const u of Array.from(urls).slice(0, 120)) console.log("    ", u);
  const pal = new Set();
  for (const m of r.corpo.matchAll(/["'`]([^"'`\n]{0,80}(?:conilon|cotac|indicador|firestore|firebase|supabase|graphql|\/api\/|\.json)[^"'`\n]{0,80})["'`]/gi)) pal.add(m[1]);
  console.log(`   Strings-chave (${pal.size}):`); for (const p of Array.from(pal).slice(0, 80)) console.log("    ", p);
  janelas(r.corpo, /conilon/gi, 250, 4);
  // main.dart.js costuma estar em outro nome dentro do bootstrap
  for (const m of r.corpo.matchAll(/["']([^"']*main\.dart[^"']*\.js)["']/g)) console.log("   main.dart candidato:", m[1]);
}

// 2) CCCV: tabela completa do mês.
{
  const r = await baixar("https://www.cccv.org.br/cotacao/");
  if (r.corpo) {
    const t = texto(r.corpo);
    const i = t.indexOf("Cotação do café referente");
    console.log("### CCCV texto a partir do título (3500):\n" + t.slice(Math.max(0, i), i + 3500));
    console.log("### CCCV HTML da tabela (primeiros 4000 após <table):");
    const j = r.corpo.indexOf("<table");
    console.log(r.corpo.slice(j, j + 4000));
  }
}

// 3) Notícias Agrícolas: achar a página do conilon.
{
  const r = await baixar("https://www.noticiasagricolas.com.br/cotacoes/cafe");
  if (r.corpo) {
    const links = new Set();
    for (const m of r.corpo.matchAll(/href=["']([^"']*cafe[^"']*)["']/gi)) if (/conilon|robusta|cepea|esalq|fisico|espirito/i.test(m[1])) links.add(m[1]);
    console.log("   links café:", Array.from(links).slice(0, 30));
    const t = texto(r.corpo);
    janelas(t, /conilon/gi, 300, 5);
  }
}

// 4) CEPEA com cabeçalhos de navegador completos (a 1ª tentativa deu 403).
{
  const r = await baixar("https://www.cepea.esalq.usp.br/br/indicador/cafe.aspx", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", { Referer: "https://www.cepea.esalq.usp.br/br/", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document", "Upgrade-Insecure-Requests": "1" });
  if (r.corpo) janelas(texto(r.corpo), /robusta|conilon|ar[áa]bica/gi, 300, 4);
}
