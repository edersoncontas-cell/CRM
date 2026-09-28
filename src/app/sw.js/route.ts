// O service worker é SERVIDO POR AQUI (e não como arquivo fixo em public/)
// por um motivo só: o navegador só instala um service worker novo quando os
// BYTES do arquivo mudam. Um sw.js estático nunca muda entre um deploy e
// outro, então o navegador seguia com o worker velho e o cache velho — era
// por isso que uma atualização podia sair no ar e o CRM continuar mostrando
// a versão antiga no aparelho.
//
// Gerando aqui, o número da versão do deploy entra dentro do arquivo: muda o
// byte, o navegador instala o worker novo, e o activate apaga todo cache que
// não seja o desta versão.

export const dynamic = "force-dynamic";

function versaoDoDeploy(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.VERCEL_DEPLOYMENT_ID ??
    process.env.NEXT_PUBLIC_BUILD_ID ??
    "dev"
  ).slice(0, 12);
}

export async function GET() {
  const versao = versaoDoDeploy();

  // String.raw: as expressões regulares do worker têm barra invertida, e um
  // template comum comeria as barras (\d viraria d). Nada de crase dentro.
  const codigo = String.raw`// Gerado por src/app/sw.js/route.ts — não editar no navegador.
// Versão do deploy: ${versao}
const VERSAO = ${JSON.stringify(versao)};
const CACHE = "crm-nh-" + VERSAO;
const ESSENCIAIS = ["/manifest.json", "/icon-192.png", "/icon-512.png"];

// ── Modo sem sinal ──────────────────────────────────────────────────────────
// Sem internet, qualquer tela do CRM abre a tela do modo sem sinal, que lê o
// que ficou guardado no aparelho (visitas, clientes, funil) e guarda o que o
// vendedor fizer até o sinal voltar. Ver src/lib/sem-sinal-regra.ts.
const SEM_SINAL = "/sem-sinal";
// Quanto esperar a rede numa troca de tela antes de desistir e abrir o modo
// sem sinal. Folgado de propósito: banco acordando leva alguns segundos, e
// cair no modo sem sinal COM internet seria pior que esperar.
const PRAZO_NAVEGACAO_MS = 20000;
// A tela guardada é conferida de novo no máximo a cada 10 minutos.
const RENOVAR_SEM_SINAL_MS = 10 * 60 * 1000;
const PRAZO_PREPARO_NA_INSTALACAO_MS = 15000;

// Sem internet E sem a tela guardada (aparelho que nunca abriu o CRM depois
// desta versão): em vez da página de erro do navegador, o motivo por extenso.
const PAGINA_SEM_PREPARO = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem internet</title>'
  + '<style>body{margin:0;font-family:system-ui,-apple-system,sans-serif;background:#09090b;color:#e4e4e7;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}'
  + 'main{max-width:420px;text-align:center}h1{font-size:20px;margin:0 0 8px}p{font-size:15px;line-height:1.5;color:#a1a1aa;margin:0 0 12px}'
  + 'button{margin-top:8px;border:0;border-radius:12px;background:#2563eb;color:#fff;font-weight:700;font-size:15px;padding:12px 20px}</style></head>'
  + '<body><main><h1>Sem internet agora</h1>'
  + '<p>Este aparelho ainda não guardou o modo sem sinal do CRM, então não há o que mostrar sem conexão.</p>'
  + '<p>Na próxima vez que você abrir o CRM com internet, ele guarda sozinho — e daí em diante as visitas, os clientes e o funil abrem mesmo sem sinal.</p>'
  + '<button onclick="location.reload()">Tentar de novo</button></main></body></html>';

function comPrazo(promessa, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("prazo")), ms);
    promessa.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

// Os arquivos que a tela precisa para abrir: scripts, estilo e fontes. O
// HTML cita parte como "/_next/static/..." (tags) e parte como
// "static/chunks/..." (dados do React, que carregam os componentes).
function arquivosDoHtml(html) {
  const achados = new Set();
  let m;
  const cheio = /\/_next\/static\/[^"'\s\\)<>?#]+/g;
  while ((m = cheio.exec(html))) achados.add(m[0]);
  const curto = /"(static\/(?:chunks|css|media)\/[^"'\s\\)<>?#]+)/g;
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
      return { ok: false, motivo: "a tela não veio (" + res.status + (res.redirected ? ", sessão" : "") + ")" };
    }
    const html = await res.text();
    const lista = arquivosDoHtml(html);
    if (!lista.length) return { ok: false, motivo: "a tela veio sem arquivos" };
    const vistos = new Set(lista);
    const faltando = [];
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i];
      let r = await cache.match(a, { ignoreSearch: true });
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
    await cache.put(SEM_SINAL, new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "x-guardado-em": String(Date.now()) },
    }));
    // Com a tela desta versão guardada, a das versões antigas pode ir embora.
    const chaves = await caches.keys();
    await Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    return { ok: true, arquivos: lista.length };
  })().finally(() => { preparando = null; });
  return preparando;
}

self.addEventListener("install", (e) => {
  // Um por um, e engolindo falha: com addAll, UM arquivo faltando derruba a
  // instalação inteira do worker — foi exatamente o que acontecia aqui (a
  // lista pedia /icon.svg, que não existe), e por isso o service worker
  // nunca instalou, nunca controlou a página e o push nunca funcionou.
  // O preparo do modo sem sinal também não derruba nada: com prazo, e se
  // falhar a tela pede de novo depois.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ESSENCIAIS.map((u) => c.add(u).catch(() => {}))))
      .then(() => comPrazo(prepararSemSinal(true), PRAZO_PREPARO_NA_INSTALACAO_MS).catch(() => {}))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  // Todo cache de versão anterior vai embora: é isto que garante que uma
  // atualização apareça de verdade no aparelho. UMA exceção: se esta versão
  // ainda não conseguiu guardar o modo sem sinal, fica o último cache que o
  // tem (tela e arquivos da mesma versão, que abrem juntos) até ela
  // conseguir — senão uma atualização saindo no ar tiraria o modo sem sinal
  // de quem está na rua.
  e.waitUntil((async () => {
    const chaves = await caches.keys();
    const velhas = chaves.filter((k) => k !== CACHE);
    const nova = await caches.open(CACHE);
    let manter = null;
    if (!(await nova.match(SEM_SINAL))) {
      for (let i = velhas.length - 1; i >= 0 && !manter; i--) {
        const c = await caches.open(velhas[i]);
        if (await c.match(SEM_SINAL)) manter = velhas[i];
      }
    }
    await Promise.all(velhas.filter((k) => k !== manter).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.tipo !== "preparar-sem-sinal") return;
  e.waitUntil(
    prepararSemSinal(Boolean(d.forcar))
      .then((r) => { if (e.source) e.source.postMessage(Object.assign({ tipo: "sem-sinal-preparado" }, r)); })
      .catch((err) => { if (e.source) e.source.postMessage({ tipo: "sem-sinal-preparado", ok: false, motivo: String(err && err.message || err) }); })
  );
});

function paraOModoSemSinal(url) {
  return caches.match(SEM_SINAL).then((guardada) => {
    if (guardada) {
      const destino = new URL(SEM_SINAL + "?de=" + encodeURIComponent(url.pathname + url.search), self.location.origin);
      return Response.redirect(destino.href, 302);
    }
    return new Response(PAGINA_SEM_PREPARO, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
  });
}

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
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // O próprio worker nunca sai do cache, senão ele se perpetuaria.
  if (url.pathname === "/sw.js") return;
  // API é dado vivo: nunca do cache (mensagem, conversa, número do painel).
  if (url.pathname.startsWith("/api/")) return;
  // Troca de tela por dentro do app (dados do Next): só rede. Sem internet
  // ela falha, o Next faz a navegação completa — e essa cai no modo sem sinal.
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
        caches.match(SEM_SINAL).then((guardada) => guardada || fetch(req).catch(() => paraOModoSemSinal(url)))
      );
      e.waitUntil(prepararSemSinal(false).catch(() => {}));
      return;
    }
    // Telas do CRM: sempre da rede. Tela velha guardada mostraria número
    // velho e botões que não fazem nada — sem rede, vai para o modo sem sinal.
    e.respondWith(comPrazo(fetch(req), PRAZO_NAVEGACAO_MS).catch(() => paraOModoSemSinal(url)));
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

  return new Response(codigo, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // O navegador precisa reconferir o worker toda vez, senão ele mesmo
      // fica preso numa cópia velha e o problema volta.
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
