// O CÓDIGO DO SERVICE WORKER, gerado como texto.
//
// Servido por src/app/sw.js/route.ts (ver lá por que não é um arquivo fixo em
// public/). Mora aqui, num módulo comum, para o teste poder gerar o worker e
// rodá-lo de verdade (tests/sw-worker.test.ts): arquivo de rota do Next só
// pode exportar GET, dynamic e afins.
//
// O que ele faz, sem internet:
//  - a tela pedida abre da CÓPIA guardada no aparelho, para ler (regras em
//    lib/sem-sinal-telas.ts);
//  - tela sem cópia vai para o modo sem sinal (/sem-sinal), que mostra as
//    visitas, os clientes e o funil guardados e guarda o que o vendedor fizer
//    até o sinal voltar (lib/sem-sinal-regra.ts), dizendo por que desviou.

import {
  TELAS_PRINCIPAIS, TELAS_SEM_COPIA, RENOVAR_TELA_MS, MAX_TELAS_GUARDADAS, MARCA_TELA_OK, PEDACO_QUE_CAIU,
  ESPERA_DEPOIS_DA_MUDANCA_MS, INTERVALO_RENOVACAO_POR_MUDANCA_MS, SUBIDA_SEM_SINAL, GRAVA_SEM_MUDAR_TELA,
} from "@/lib/sem-sinal-telas";

export function codigoDoWorker(versao: string): string {
  // String.raw: as expressões regulares do worker têm barra invertida, e um
  // template comum comeria as barras (\d viraria d). Nada de crase dentro, e
  // nada de cifrão seguido de chave fora das listas abaixo.
  return String.raw`// Gerado por src/lib/sw-codigo.ts — não editar no navegador.
// Versão do deploy: ${versao}
const VERSAO = ${JSON.stringify(versao)};
const CACHE = "crm-nh-" + VERSAO;
const ESSENCIAIS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];

// ── Sem internet ────────────────────────────────────────────────────────────
const SEM_SINAL = "/sem-sinal";
// Quanto esperar a rede numa troca de tela antes de desistir e abrir a cópia.
// Folgado de propósito: banco acordando leva alguns segundos, e cair na cópia
// COM internet seria pior que esperar.
const PRAZO_NAVEGACAO_MS = 20000;
// A tela do modo sem sinal é conferida de novo no máximo a cada 10 minutos.
const RENOVAR_SEM_SINAL_MS = 10 * 60 * 1000;
const PRAZO_PREPARO_NA_INSTALACAO_MS = 15000;

// Cópias das telas do CRM (regras em src/lib/sem-sinal-telas.ts).
const TELAS_PRINCIPAIS = ${JSON.stringify(TELAS_PRINCIPAIS)};
const TELAS_SEM_COPIA = ${JSON.stringify(TELAS_SEM_COPIA)};
const RENOVAR_TELA_MS = ${RENOVAR_TELA_MS};
const MAX_TELAS = ${MAX_TELAS_GUARDADAS};
const MARCA_TELA_OK = ${JSON.stringify(MARCA_TELA_OK)};
// A tela aberta com internet vira cópia depois que o navegador termina de
// baixar os arquivos dela (eles passam por aqui e ficam guardados) — antes
// disso, os mesmos arquivos desceriam duas vezes.
const ESPERA_ANTES_DA_COPIA_MS = 4000;
// Mudou dado: as cópias se renovam logo (regra em src/lib/sem-sinal-telas.ts).
const ESPERA_DEPOIS_DA_MUDANCA_MS = ${ESPERA_DEPOIS_DA_MUDANCA_MS};
const INTERVALO_RENOVACAO_POR_MUDANCA_MS = ${INTERVALO_RENOVACAO_POR_MUDANCA_MS};
const SUBIDA_SEM_SINAL = ${JSON.stringify(SUBIDA_SEM_SINAL)};
const GRAVA_SEM_MUDAR_TELA = ${JSON.stringify(GRAVA_SEM_MUDAR_TELA)};

// Sem internet E sem a tela guardada (aparelho que nunca abriu o CRM depois
// desta versão): em vez da página de erro do navegador, o motivo por extenso.
const PAGINA_SEM_PREPARO = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem internet</title>'
  + '<style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#09090b;color:#e4e4e7;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}'
  + 'main{max-width:420px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{font-size:15px;line-height:1.5;color:#a1a1aa;margin:0 0 12px}'
  + 'button{margin-top:8px;border:0;border-radius:12px;background:#2563eb;color:#fff;font-weight:700;font-size:15px;padding:12px 20px}</style></head>'
  + '<body><main><h1>Sem internet agora</h1>'
  + '<p>Este aparelho ainda não guardou o modo sem sinal do CRM, então não há o que mostrar sem conexão.</p>'
  + '<p>Na próxima vez que você abrir o CRM com internet, ele guarda sozinho — e daí em diante as visitas, os clientes e as negociações abrem mesmo sem sinal.</p>'
  + '<button onclick="location.reload()">Tentar de novo</button></main></body></html>';

function comPrazo(promessa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("prazo")), ms);
    promessa.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// As mesmas regras de src/lib/sem-sinal-telas.ts (o teste confere).
function telaGuardavel(caminho) {
  if (caminho.charAt(0) !== "/" || caminho === "/") return false;
  return !TELAS_SEM_COPIA.some((p) => caminho === p || caminho.indexOf(p + "/") === 0);
}

function mudaAsCopias(caminhoPedido, tela) {
  if (GRAVA_SEM_MUDAR_TELA.some((p) => caminhoPedido === p || caminhoPedido.indexOf(p + "/") === 0)) return false;
  if (caminhoPedido === SUBIDA_SEM_SINAL) return true;
  return telaGuardavel(tela || caminhoPedido);
}

const PEDACO_QUE_CAIU = ${PEDACO_QUE_CAIU.toString()};
function telaSaudavel(html) {
  return html.indexOf(MARCA_TELA_OK) >= 0 && html.indexOf("$RX=") < 0 && !PEDACO_QUE_CAIU.test(html);
}

// Nome da cópia para a lista do modo sem sinal: a ficha do cliente não tem
// nome no menu, então vale o primeiro título da tela.
function tituloDoHtml(html) {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (!m) return "";
  return m[1].replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ").trim().slice(0, 80);
}

function motivoDaResposta(res) {
  if (res.redirected) return "a sessão deste aparelho saiu (entre de novo com a senha)";
  return "o servidor respondeu " + res.status;
}

// Os arquivos que a tela precisa para abrir: scripts, estilo e fontes. O
// HTML cita parte como "/_next/static/..." (tags) e parte como
// "static/chunks/..." (dados do React, que carregam os componentes).
// O nome vai até a extensão: as telas do CRM moram em "app/(app)/...", e
// cortar no parêntese deixava a cópia sem o script da tela — sem internet,
// ela quebrava ao abrir.
function arquivosDoHtml(html) {
  const achados = new Set();
  let m;
  const cheio = /\/_next\/static\/[^"'\s\\<>?#]+?\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|ico)(?![\w.-])/g;
  while ((m = cheio.exec(html))) achados.add(m[0]);
  const curto = /"(static\/(?:chunks|css|media)\/[^"'\s\\<>?#]+?\.(?:js|css|woff2?|ttf|otf|png|jpe?g|gif|svg|webp|ico))(?![\w.-])/g;
  while ((m = curto.exec(html))) achados.add("/_next/" + m[1]);
  return [...achados];
}

function arquivosDoCss(css) {
  const achados = [];
  let m;
  const re = /url\(\s*['"]?(\/_next\/static\/[^'")\s?#]+)/g;
  while ((m = re.exec(css))) achados.push(m[1]);
  return achados;
}

// O desta versão primeiro; o de uma versão anterior mantida serve de reserva.
async function acharGuardado(chave) {
  const nova = await caches.open(CACHE);
  return (await nova.match(chave)) || (await caches.match(chave)) || null;
}

// Guarda os arquivos de uma tela nesta versão. Script ou estilo faltando é
// tela em branco sem internet — pior que não ter a tela —, então é falha.
async function guardarArquivos(cache, arquivos) {
  const lista = arquivos.slice();
  const vistos = new Set(lista);
  const faltando = [];
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    let r = await cache.match(a, { ignoreSearch: true });
    if (!r) {
      // Arquivo que não mudou entre versões: vem do cache anterior, sem rede.
      const velho = await caches.match(a, { ignoreSearch: true });
      if (velho) { await cache.put(a, velho.clone()); r = velho; }
    }
    if (!r) {
      try {
        const rede = await fetch(a, { credentials: "same-origin" });
        if (!rede.ok) { faltando.push(a); continue; }
        await cache.put(a, rede.clone());
        r = rede;
      } catch (err) { faltando.push(a); continue; }
    }
    // O estilo cita as fontes: vão junto.
    if (/\.css$/.test(a)) {
      const css = await r.clone().text().catch(() => "");
      for (const f of arquivosDoCss(css)) if (!vistos.has(f)) { vistos.add(f); lista.push(f); }
    }
  }
  const essenciais = faltando.filter((a) => /\.(?:js|css)$/.test(a));
  if (essenciais.length) return { ok: false, motivo: essenciais.length + " arquivo(s) da tela não baixaram" };
  return { ok: true, arquivos: lista.length };
}

let preparando = null;

// Guarda a tela do modo sem sinal e TODOS os arquivos dela. A tela só entra
// no cache depois dos arquivos: tela guardada sem o script dela abriria em
// branco, que é pior que a página de "sem preparo".
function prepararSemSinal(forcar) {
  if (preparando) return preparando;
  preparando = (async () => {
    const cache = await caches.open(CACHE);
    const atual = await cache.match(SEM_SINAL);
    if (atual && !forcar) {
      const em = Number(atual.headers.get("x-guardado-em") || 0);
      if (Date.now() - em < RENOVAR_SEM_SINAL_MS) return { ok: true, pulou: true };
    }
    const res = await fetch(SEM_SINAL, { credentials: "same-origin", cache: "no-store" });
    // Sessão vencida: o servidor manda para /login. Guardar ISSO no lugar do
    // modo sem sinal mostraria a tela de login sem internet para entrar.
    if (!res.ok || res.redirected || new URL(res.url).pathname !== SEM_SINAL) {
      return { ok: false, motivo: motivoDaResposta(res) };
    }
    const html = await res.text();
    const lista = arquivosDoHtml(html);
    if (!lista.length) return { ok: false, motivo: "a tela veio sem arquivos" };
    const r = await guardarArquivos(cache, lista);
    if (!r.ok) return r;
    await cache.put(SEM_SINAL, new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "x-guardado-em": String(Date.now()) },
    }));
    await limparVersoesAntigas().catch(() => {});
    return { ok: true, arquivos: r.arquivos };
  })().finally(() => { preparando = null; });
  return preparando;
}

// ── Cópias das telas ────────────────────────────────────────────────────────

// Uma tela por vez: cada cópia é uma tela montada no servidor, e várias ao
// mesmo tempo disputariam o banco com o que o vendedor está fazendo.
let filaTelas = Promise.resolve();
function naFila(tarefa) {
  const vez = filaTelas.then(tarefa, tarefa);
  filaTelas = vez.catch(() => {});
  return vez;
}

async function guardarCopia(caminho, html) {
  // Tela que veio com erro (banco fora, pedaço que caiu) não substitui a
  // cópia boa: sem sinal, ela é tudo o que ele tem.
  if (!telaSaudavel(html)) return { ok: false, motivo: "a tela veio com erro" };
  const lista = arquivosDoHtml(html);
  if (!lista.length) return { ok: false, motivo: "a tela veio sem arquivos" };
  const cache = await caches.open(CACHE);
  const r = await guardarArquivos(cache, lista);
  if (!r.ok) return r;
  await cache.put(caminho, new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "x-guardado-em": String(Date.now()),
      "x-tela": "1",
      "x-titulo": encodeURIComponent(tituloDoHtml(html)),
    },
  }));
  await apararCopias(cache);
  return { ok: true };
}

// Pede a tela ao servidor e guarda — só se a cópia tiver mais de uma hora.
async function guardarTela(caminho, forcar) {
  if (!telaGuardavel(caminho)) return { ok: false, motivo: "esta tela não fica guardada" };
  const cache = await caches.open(CACHE);
  const atual = await cache.match(caminho);
  if (atual && !forcar && Date.now() - Number(atual.headers.get("x-guardado-em") || 0) < RENOVAR_TELA_MS) {
    return { ok: true, pulou: true };
  }
  const res = await fetch(caminho, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok || res.redirected || new URL(res.url).pathname !== caminho) return { ok: false, motivo: motivoDaResposta(res) };
  return guardarCopia(caminho, await res.text());
}

function ehChaveDeTela(req) {
  const p = new URL(req.url).pathname;
  return p.indexOf("/_next/") !== 0 && p !== SEM_SINAL && !/\.[a-z0-9]+$/i.test(p);
}

// Teto de cópias: as principais ficam sempre; das avulsas saem as mais velhas.
async function apararCopias(cache) {
  const avulsas = [];
  let principais = 0;
  const chaves = await cache.keys();
  for (let i = 0; i < chaves.length; i++) {
    const k = chaves[i];
    if (!ehChaveDeTela(k)) continue;
    const r = await cache.match(k);
    if (!r || !r.headers.get("x-tela")) continue;
    if (TELAS_PRINCIPAIS.indexOf(new URL(k.url).pathname) >= 0) { principais++; continue; }
    avulsas.push({ k: k, em: Number(r.headers.get("x-guardado-em") || 0), ordem: i });
  }
  // Mesma hora (várias guardadas no mesmo instante): vale a ordem do cache,
  // que põe a regravada no fim.
  avulsas.sort((a, b) => b.em - a.em || b.ordem - a.ordem);
  const cabem = Math.max(0, MAX_TELAS - principais);
  await Promise.all(avulsas.slice(cabem).map((a) => cache.delete(a.k)));
}

// Com a tela do modo sem sinal e TODAS as principais guardadas nesta versão,
// as versões antigas podem sair. Antes disso não: uma atualização saindo no
// ar tiraria as cópias de quem está na rua.
async function limparVersoesAntigas() {
  const cache = await caches.open(CACHE);
  if (!(await cache.match(SEM_SINAL))) return false;
  for (const t of TELAS_PRINCIPAIS) if (!(await cache.match(t))) return false;
  const chaves = await caches.keys();
  await Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
  return true;
}

// forcar: refaz mesmo a de menos de uma hora (mudou dado). extras: outras
// telas que também ficaram velhas (a ficha onde a mudança aconteceu).
function renovarPrincipais(forcar, extras) {
  return naFila(async () => {
    let guardadas = 0;
    const falhas = [];
    const telas = TELAS_PRINCIPAIS.concat((extras || []).filter((t) => TELAS_PRINCIPAIS.indexOf(t) < 0 && telaGuardavel(t)));
    for (const t of telas) {
      try {
        const r = await guardarTela(t, Boolean(forcar));
        if (!r.ok) falhas.push(t + ": " + r.motivo);
        else if (!r.pulou) guardadas++;
      } catch (err) {
        falhas.push(t + ": sem conexão");
      }
    }
    await limparVersoesAntigas().catch(() => false);
    return { guardadas: guardadas, falhas: falhas };
  });
}

// Mudou dado: renova quando a rajada acabar, no máximo a cada 3 min. Cada
// mudança marca a sua vez; só a última da rajada renova (as de antes veem
// que veio outra depois e saem). Sem internet a renovação falha e a cópia
// que havia fica — nunca se apaga cópia aqui.
// A subida do modo sem sinal é urgente: não espera o intervalo — é a hora em
// que o sinal voltou, e ele pode cair de novo em seguida.
let mudancas = 0;
let renovadoPorMudancaEm = 0;
let urgentePendente = false;
const telasMudadas = new Set();
function depoisDaMudanca(tela, urgente) {
  const minha = ++mudancas;
  if (urgente) urgentePendente = true;
  if (tela && telaGuardavel(tela)) telasMudadas.add(tela);
  const espera = urgentePendente
    ? ESPERA_DEPOIS_DA_MUDANCA_MS
    : Math.max(ESPERA_DEPOIS_DA_MUDANCA_MS, renovadoPorMudancaEm + INTERVALO_RENOVACAO_POR_MUDANCA_MS - Date.now());
  return esperar(espera).then(() => {
    if (minha !== mudancas) return null;
    urgentePendente = false;
    renovadoPorMudancaEm = Date.now();
    const extras = Array.from(telasMudadas);
    telasMudadas.clear();
    return renovarPrincipais(true, extras);
  });
}

// Sem rede: a cópia desta tela; sem cópia, o modo sem sinal dizendo por quê.
async function semRede(url) {
  const caminho = url.pathname === "/" ? "/dashboard" : url.pathname;
  if (!telaGuardavel(caminho)) return paraOModoSemSinal(url, "nao-guarda");
  const copia = await acharGuardado(caminho);
  if (copia && copia.headers.get("x-tela")) return copia;
  return paraOModoSemSinal(url, "sem-copia");
}

async function paraOModoSemSinal(url, motivo) {
  const guardada = await acharGuardado(SEM_SINAL);
  if (guardada) {
    let destino = SEM_SINAL + "?de=" + encodeURIComponent(url.pathname + url.search);
    if (motivo) destino += "&motivo=" + motivo;
    return Response.redirect(new URL(destino, self.location.origin).href, 302);
  }
  return new Response(PAGINA_SEM_PREPARO, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// ── Ciclo de vida ───────────────────────────────────────────────────────────

self.addEventListener("install", (e) => {
  // Um por um, e engolindo falha: com addAll, UM arquivo faltando derruba a
  // instalação inteira do worker — foi exatamente o que acontecia aqui (a
  // lista pedia /icon.svg, que não existe), e por isso o service worker
  // nunca instalou, nunca controlou a página e o push nunca funcionou.
  // O preparo do modo sem sinal também não derruba nada: com prazo, e se
  // falhar a tela pede de novo depois. As cópias das telas vêm depois, a
  // pedido da tela (mensagem "preparar-sem-sinal").
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ESSENCIAIS.map((u) => c.add(u).catch(() => {}))))
      .then(() => comPrazo(prepararSemSinal(true), PRAZO_PREPARO_NA_INSTALACAO_MS).catch(() => {}))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  // Cache de versão anterior sai: é isto que garante que uma atualização
  // apareça de verdade no aparelho. UMA exceção: o mais novo que tenha o modo
  // sem sinal fica até esta versão guardar o dela e as telas principais
  // (limparVersoesAntigas) — tela e arquivos da mesma versão abrem juntos, e
  // quem está na rua não fica sem nada no meio da troca.
  e.waitUntil((async () => {
    const chaves = await caches.keys();
    const velhas = chaves.filter((k) => k !== CACHE);
    let manter = null;
    for (let i = velhas.length - 1; i >= 0 && !manter; i--) {
      const c = await caches.open(velhas[i]);
      if (await c.match(SEM_SINAL)) manter = velhas[i];
    }
    await Promise.all(velhas.filter((k) => k !== manter).map((k) => caches.delete(k)));
    await limparVersoesAntigas().catch(() => false);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  const d = e.data || {};
  const responder = (m) => { if (e.source) e.source.postMessage(m); };
  if (d.tipo === "preparar-sem-sinal") {
    // Primeiro a tela do modo sem sinal (a que registra), depois as cópias
    // das principais — cada uma responde, para a tela mostrar o que falhou.
    e.waitUntil(
      prepararSemSinal(Boolean(d.forcar))
        .then(
          (r) => responder(Object.assign({ tipo: "sem-sinal-preparado" }, r)),
          (err) => responder({ tipo: "sem-sinal-preparado", ok: false, motivo: String((err && err.message) || err) }),
        )
        .then(() => renovarPrincipais())
        .then(
          (r) => responder(Object.assign({ tipo: "telas-guardadas" }, r)),
          (err) => responder({ tipo: "telas-guardadas", guardadas: 0, falhas: [String((err && err.message) || err)] }),
        )
    );
    return;
  }
  if (d.tipo === "telas-mudaram" && Array.isArray(d.caminhos)) {
    // A tela avisa: uma ação dela gravou (a tela onde foi vai junto), ou a
    // subida do modo sem sinal terminou (urgente, com as fichas dos clientes).
    d.caminhos.slice(0, 50).forEach((c) => { if (typeof c === "string" && telaGuardavel(c)) telasMudadas.add(c); });
    e.waitUntil(depoisDaMudanca(null, Boolean(d.urgente)).catch(() => {}));
    return;
  }
  if (d.tipo === "guardar-tela" && typeof d.caminho === "string") {
    e.waitUntil(
      naFila(() => guardarTela(d.caminho, false))
        .then((r) => responder(Object.assign({ tipo: "telas-guardadas", guardadas: r.ok && !r.pulou ? 1 : 0, falhas: r.ok ? [] : [d.caminho + ": " + r.motivo] })))
        .catch(() => {})
    );
  }
});

// Arquivos com nome de versão (/_next/static): nunca mudam, então o guardado
// vale — e é o que deixa a tela abrir sem internet.
function guardadoOuRede(req) {
  return caches.match(req, { ignoreSearch: true }).then((guardado) => {
    if (guardado) return guardado;
    return fetch(req).then((res) => {
      if (res.ok) {
        const copia = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
      }
      return res;
    });
  });
}

const ARQUIVO_PUBLICO = /\.(?:png|jpe?g|gif|svg|webp|ico|woff2?|ttf|json)$/i;

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") {
    // Pedido que grava: aqui só se anota que as cópias ficaram velhas.
    if (req.method === "HEAD") return;
    const alvo = new URL(req.url);
    if (alvo.origin !== self.location.origin) return;
    let tela = null;
    try {
      const de = new URL(req.referrer);
      if (de.origin === self.location.origin) tela = de.pathname;
    } catch (err) { /* sem referrer */ }
    // Ação da tela (server action): quem avisa é a própria tela, que vê a
    // resposta (mensagem "telas-mudaram"). O worker não põe a mão no envio do
    // que ele grava — um defeito aqui não pode impedir o CRM de gravar.
    if (req.headers.get("Next-Action")) return;
    // Rota /api (subida do modo sem sinal, áudio da demanda…): segue direto.
    if (mudaAsCopias(alvo.pathname, tela)) {
      e.waitUntil(depoisDaMudanca(tela || alvo.pathname, alvo.pathname === SUBIDA_SEM_SINAL).catch(() => {}));
    }
    return;
  }
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // O próprio worker nunca sai do cache, senão ele se perpetuaria.
  if (url.pathname === "/sw.js") return;
  // API é dado vivo: nunca do cache (mensagem, conversa, número do painel).
  if (url.pathname.startsWith("/api/")) return;
  // Troca de tela por dentro do app (dados do Next): só rede. Sem internet
  // ela falha, o Next faz a navegação completa — e essa cai na cópia.
  if (req.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(guardadoOuRede(req));
    return;
  }

  if (req.mode === "navigate") {
    if (url.pathname === SEM_SINAL) {
      // A tela do modo sem sinal abre do guardado (é para abrir sem rede) e
      // se renova por trás, no máximo a cada 10 min.
      e.respondWith(
        acharGuardado(SEM_SINAL).then((guardada) => guardada || fetch(req).catch(() => paraOModoSemSinal(url, null)))
      );
      e.waitUntil(prepararSemSinal(false).catch(() => {}));
      return;
    }
    // Telas do CRM: sempre da rede — tela velha com internet mostraria
    // número velho. A resposta boa vira a cópia desta tela (de graça: o
    // servidor já montou); sem rede, abre a cópia.
    const guardar = telaGuardavel(url.pathname) && !url.search;
    const rede = comPrazo(fetch(req), PRAZO_NAVEGACAO_MS).then((res) => ({
      res: res,
      copia: guardar && res.status === 200 && res.type === "basic" && !res.redirected
        && (res.headers.get("content-type") || "").indexOf("text/html") >= 0 ? res.clone() : null,
    }));
    e.respondWith(rede.then((x) => x.res, () => semRede(url)));
    e.waitUntil(
      rede
        .then((x) => x.copia && x.copia.text()
          .then((html) => esperar(ESPERA_ANTES_DA_COPIA_MS).then(() => naFila(() => guardarCopia(url.pathname, html)))))
        .catch(() => {})
    );
    return;
  }

  // Ícones, manifesto, fontes públicas: rede, e o guardado quando não houver.
  if (!ARQUIVO_PUBLICO.test(url.pathname)) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && !res.redirected) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || Response.error()))
  );
});

// ── Notificações push ────────────────────────────────────────────────────────

self.addEventListener("push", (e) => {
  let data = { title: "CRM Edy", body: "Nova mensagem recebida!", url: "/atendimento", tag: "msg" };
  try { data = { ...data, ...e.data.json() }; } catch {}

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      renotify: true,
      data: { url: data.url },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/atendimento";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
`;
}
