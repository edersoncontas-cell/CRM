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

  const codigo = `// Gerado por src/app/sw.js/route.ts — não editar no navegador.
// Versão do deploy: ${versao}
const VERSAO = ${JSON.stringify(versao)};
const CACHE = "crm-nh-" + VERSAO;
const ESSENCIAIS = ["/manifest.json", "/icon-192.png"];

self.addEventListener("install", (e) => {
  // Um por um, e engolindo falha: com addAll, UM arquivo faltando derruba a
  // instalação inteira do worker — foi exatamente o que acontecia aqui (a
  // lista pedia /icon.svg, que não existe), e por isso o service worker
  // nunca instalou, nunca controlou a página e o push nunca funcionou.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(ESSENCIAIS.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  // Todo cache de versão anterior vai embora: é isto que garante que uma
  // atualização apareça de verdade no aparelho.
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isApi = url.pathname.startsWith("/api/");
  // O próprio worker nunca sai do cache, senão ele se perpetuaria.
  if (url.pathname === "/sw.js") return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        // Nunca cacheia resposta de API — é dado vivo; servir do cache daria
        // informação errada (mensagem, conversa, número do painel).
        if (!isApi && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        }
        return res;
      })
      .catch((err) => {
        if (isApi) throw err; // a página trata a falha de rede do jeito dela
        return caches.match(req).then((r) => r || caches.match("/dashboard"));
      })
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
