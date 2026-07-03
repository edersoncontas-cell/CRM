// Service worker: deixa o app instalável, responde quando offline e envia push.
const CACHE = "crm-nh-v2";
const ESSENCIAIS = ["/dashboard", "/manifest.json", "/icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const isApi = new URL(req.url).pathname.startsWith("/api/");
  e.respondWith(
    fetch(req)
      .then((res) => {
        // Nunca cacheia respostas de API — são dados dinâmicos; servir do
        // cache offline daria informação errada/desatualizada (mensagens,
        // conversas, etc.). Só cacheia páginas/assets estáticos.
        if (!isApi) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => {});
        }
        return res;
      })
      .catch((err) => {
        if (isApi) throw err; // deixa a página tratar a falha de rede normalmente
        return caches.match(req).then((r) => r || caches.match("/dashboard"));
      })
  );
});

// ── Push Notifications ────────────────────────────────────────────────────────

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
  const url = e.notification.data?.url ?? "/atendimento";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});
