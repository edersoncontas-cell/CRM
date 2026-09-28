// O SERVICE WORKER RODANDO DE VERDADE, num navegador de mentira.
//
// Gera o código do worker (lib/sw-codigo.ts) e o executa num contexto
// isolado com cache, rede e eventos simulados. É o substituto do celular: não
// há Safari nem Android aqui, mas o que o worker DECIDE (abrir a cópia, desviar
// para o modo sem sinal, não guardar tela com erro, respeitar o teto) roda o
// código que vai para o aparelho, sem cópia nem tradução.

import { describe, it, expect, beforeEach } from "vitest";
import vm from "node:vm";
import { codigoDoWorker } from "@/lib/sw-codigo";
import { telaGuardavel, telaSaudavel, TELAS_PRINCIPAIS, MAX_TELAS_GUARDADAS, MARCA_TELA_OK } from "@/lib/sem-sinal-telas";

const ORIGEM = "https://crm.teste";

type Guardado = { corpo: ArrayBuffer; status: number; headers: [string, string][] };

class CacheFalso {
  m = new Map<string, Guardado>();
  chave(r: string | { url: string }) {
    return new URL(typeof r === "string" ? r : r.url, ORIGEM).href;
  }
  async match(r: string | { url: string }, o?: { ignoreSearch?: boolean }) {
    const k = this.chave(r);
    let g = this.m.get(k);
    if (!g && o?.ignoreSearch) {
      for (const [kk, v] of this.m) if (kk.split("?")[0] === k.split("?")[0]) { g = v; break; }
    }
    return g ? new Response(g.corpo.slice(0), { status: g.status, headers: g.headers }) : undefined;
  }
  async put(r: string | { url: string }, res: Response) {
    this.m.set(this.chave(r), { corpo: await res.arrayBuffer(), status: res.status, headers: [...res.headers.entries()] });
  }
  async add(u: string) {
    const res = await rede.buscar(u);
    if (!res.ok) throw new TypeError("add falhou");
    await this.put(u, res);
  }
  async delete(r: string | { url: string }) {
    return this.m.delete(this.chave(r));
  }
  async keys() {
    return [...this.m.keys()].map((url) => ({ url }));
  }
}

class CachesFalso {
  c = new Map<string, CacheFalso>();
  async open(n: string) {
    if (!this.c.has(n)) this.c.set(n, new CacheFalso());
    return this.c.get(n)!;
  }
  async keys() {
    return [...this.c.keys()];
  }
  async delete(n: string) {
    return this.c.delete(n);
  }
  async match(r: string | { url: string }, o?: { ignoreSearch?: boolean }) {
    for (const c of this.c.values()) {
      const x = await c.match(r, o);
      if (x) return x;
    }
    return undefined;
  }
}

// ── A "internet" ─────────────────────────────────────────────────────────────

const ARQUIVOS_TELA = ["/_next/static/chunks/main-1.js", "/_next/static/css/app-1.css"];

function paginaHtml(titulo: string, opcoes: { marca?: boolean; extra?: string; chunk?: string } = {}) {
  // As telas do CRM moram em "app/(app)/..." — o parêntese no nome já cortou
  // a lista de arquivos uma vez (a cópia abria sem o script da tela).
  const chunk = opcoes.chunk ?? "app/(app)/pagina/[id]/page-1.js";
  return `<!doctype html><html><head><link rel="stylesheet" href="/_next/static/css/app-1.css"/>`
    + `<script src="/_next/static/chunks/main-1.js" async=""></script>`
    + `<script src="/_next/static/chunks/app/(app)/layout-1.js" async=""></script>`
    + `<style>@font-face{src:url(/_next/static/media/inline-1.woff2) format("woff2")}</style></head>`
    + `<body><main><h1>${titulo}<!-- --> &amp; cia</h1></main>`
    + (opcoes.marca === false ? "" : `<span hidden="" ${MARCA_TELA_OK}></span>`)
    + `<script>self.__next_f.push([1,"2:I[\\"static/chunks/${chunk}\\"]"])</script>${opcoes.extra ?? ""}</body></html>`;
}

const rede = {
  offline: false,
  pedidos: [] as string[],
  paginas: new Map<string, { html: string; status?: number; redirecionaPara?: string }>(),
  async buscar(entrada: string | { url: string }): Promise<Response> {
    const url = new URL(typeof entrada === "string" ? entrada : entrada.url, ORIGEM);
    this.pedidos.push(url.pathname + url.search);
    if (this.offline) throw new TypeError("Failed to fetch");
    const vestir = (res: Response, final: string, redirected = false) => {
      Object.defineProperty(res, "type", { value: "basic" });
      Object.defineProperty(res, "url", { value: new URL(final, ORIGEM).href });
      Object.defineProperty(res, "redirected", { value: redirected });
      return res;
    };
    if (url.pathname.startsWith("/_next/static/")) {
      const css = url.pathname.endsWith(".css") ? "body{font-family:x}@font-face{src:url(/_next/static/media/fonte-1.woff2)}" : "//js";
      return vestir(new Response(css, { status: 200, headers: { "Content-Type": "text/plain" } }), url.pathname);
    }
    if (["/manifest.json", "/icon-192.png", "/icon-512.png"].includes(url.pathname)) {
      return vestir(new Response("{}", { status: 200 }), url.pathname);
    }
    const p = this.paginas.get(url.pathname);
    if (!p) return vestir(new Response("não achou", { status: 404, headers: { "Content-Type": "text/html" } }), url.pathname);
    if (p.redirecionaPara) {
      return vestir(new Response(paginaHtml("Entrar"), { status: 200, headers: { "Content-Type": "text/html" } }), p.redirecionaPara, true);
    }
    return vestir(new Response(p.html, { status: p.status ?? 200, headers: { "Content-Type": "text/html; charset=utf-8" } }), url.pathname);
  },
};

// ── O worker ─────────────────────────────────────────────────────────────────

type Evento = { resposta?: Promise<Response>; pendentes: Promise<unknown>[] };

function carregarWorker(versao: string, caches: CachesFalso) {
  const ouvintes: Record<string, (e: unknown) => void> = {};
  const ctx: Record<string, unknown> = {
    caches,
    fetch: (r: string | { url: string }) => rede.buscar(r),
    Response, Headers, URL, TextEncoder,
    // O tempo do worker corre mil vezes mais rápido (prazo de 20 s vira 20 ms).
    setTimeout: (f: () => void, ms: number) => setTimeout(f, ms / 1000),
    clearTimeout,
    console,
    location: { origin: ORIGEM },
    addEventListener: (tipo: string, f: (e: unknown) => void) => { ouvintes[tipo] = f; },
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [] },
    registration: {},
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(codigoDoWorker(versao), ctx);

  async function esperar(e: Evento) {
    const res = e.resposta ? await e.resposta : undefined;
    await Promise.all(e.pendentes.map((p) => p.catch(() => {})));
    return res;
  }

  return {
    ctx,
    async navegar(caminho: string) {
      const e: Evento & Record<string, unknown> = {
        pendentes: [],
        request: { url: new URL(caminho, ORIGEM).href, method: "GET", mode: "navigate", headers: new Headers() },
        respondWith(p: Promise<Response>) { e.resposta = Promise.resolve(p); },
        waitUntil(p: Promise<unknown>) { e.pendentes.push(p); },
      };
      ouvintes.fetch(e);
      return esperar(e);
    },
    async mensagem(data: unknown) {
      const respostas: Record<string, unknown>[] = [];
      const e: Evento & Record<string, unknown> = {
        pendentes: [],
        data,
        source: { postMessage: (m: Record<string, unknown>) => respostas.push(m) },
        waitUntil(p: Promise<unknown>) { e.pendentes.push(p); },
      };
      ouvintes.message(e);
      await esperar(e);
      return respostas;
    },
    async ciclo(tipo: "install" | "activate") {
      const e: Evento & Record<string, unknown> = { pendentes: [], waitUntil(p: Promise<unknown>) { e.pendentes.push(p); } };
      ouvintes[tipo](e);
      await esperar(e);
    },
  };
}

let caches: CachesFalso;

beforeEach(() => {
  caches = new CachesFalso();
  rede.offline = false;
  rede.pedidos = [];
  rede.paginas = new Map([["/sem-sinal", { html: paginaHtml("Modo sem sinal", { chunk: "app/sem-sinal-1.js" }) }]]);
  for (const t of TELAS_PRINCIPAIS) rede.paginas.set(t, { html: paginaHtml(`Tela ${t}`) });
  rede.paginas.set("/clientes/cl_1", { html: paginaHtml("João da Pedreira") });
  rede.paginas.set("/atendimento", { html: paginaHtml("WhatsApp") });
});

async function workerPronto(versao = "v1") {
  const sw = carregarWorker(versao, caches);
  await sw.ciclo("install");
  await sw.ciclo("activate");
  return sw;
}

describe("service worker: telas do CRM sem internet", () => {
  it("as regras do worker são as mesmas do módulo da tela", async () => {
    const sw = carregarWorker("v1", caches);
    const guardavel = sw.ctx.telaGuardavel as (c: string) => boolean;
    const saudavel = sw.ctx.telaSaudavel as (h: string) => boolean;
    for (const c of ["/dashboard", "/clientes/x", "/atendimento", "/atendimento/relatorio", "/zeuss", "/", "/sem-sinal", "/api/x", "/_next/static/a.js", "/login"]) {
      expect(guardavel(c), c).toBe(telaGuardavel(c));
    }
    for (const h of [
      paginaHtml("a"), paginaHtml("a", { marca: false }), paginaHtml("a", { extra: "<script>$RX=1</script>" }),
      paginaHtml("a", { extra: '<template data-dgst="x">' }), paginaHtml("a", { extra: '<template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING">' }),
      paginaHtml("a", { extra: '<script>$RC=function(){a.setAttribute("data-dgst",e)}</script>' }),
    ]) {
      expect(saudavel(h)).toBe(telaSaudavel(h));
    }
  });

  it("acha todos os arquivos da tela, com parêntese no nome e sem levar o do CSS", () => {
    const sw = carregarWorker("v1", caches);
    const achar = sw.ctx.arquivosDoHtml as (h: string) => string[];
    expect([...achar(paginaHtml("Clientes"))].sort()).toEqual([
      "/_next/static/chunks/app/(app)/layout-1.js",
      "/_next/static/chunks/app/(app)/pagina/[id]/page-1.js",
      "/_next/static/chunks/main-1.js",
      "/_next/static/css/app-1.css",
      "/_next/static/media/inline-1.woff2",
    ]);
  });

  it("a instalação guarda a tela do modo sem sinal com os arquivos dela", async () => {
    await workerPronto();
    const c = await caches.open("crm-nh-v1");
    expect(await c.match("/sem-sinal")).toBeTruthy();
    expect(await c.match("/_next/static/chunks/app/sem-sinal-1.js")).toBeTruthy();
    // A fonte citada pelo CSS vai junto.
    expect(await c.match("/_next/static/media/fonte-1.woff2")).toBeTruthy();
  });

  it("com internet, a tela aberta vem da rede e vira cópia; sem internet, abre a cópia", async () => {
    const sw = await workerPronto();
    const online = await sw.navegar("/clientes/cl_1");
    expect(await online!.text()).toContain("João da Pedreira");

    // O script da própria tela (em "app/(app)/…") ficou guardado com ela.
    const c = await caches.open("crm-nh-v1");
    expect(await c.match("/_next/static/chunks/app/(app)/pagina/[id]/page-1.js")).toBeTruthy();

    rede.offline = true;
    const off = await sw.navegar("/clientes/cl_1");
    expect(off!.status).toBe(200);
    expect(off!.headers.get("x-tela")).toBe("1");
    expect(decodeURIComponent(off!.headers.get("x-titulo")!)).toBe("João da Pedreira & cia");
    expect(await off!.text()).toContain("João da Pedreira");
  });

  it("o pedido do app guarda as telas principais — e não refaz antes de uma hora", async () => {
    const sw = await workerPronto();
    const r = await sw.mensagem({ tipo: "preparar-sem-sinal" });
    expect(r.map((m) => m.tipo)).toEqual(["sem-sinal-preparado", "telas-guardadas"]);
    expect(r[1]).toMatchObject({ guardadas: TELAS_PRINCIPAIS.length, falhas: [] });

    rede.pedidos = [];
    const r2 = await sw.mensagem({ tipo: "preparar-sem-sinal" });
    expect(r2[1]).toMatchObject({ guardadas: 0, falhas: [] });
    // Nenhuma tela montada de novo no servidor: nada de peso extra no banco.
    expect(rede.pedidos.filter((p) => TELAS_PRINCIPAIS.includes(p))).toEqual([]);

    // Uma hora depois, refaz.
    vm.runInContext("Date.now = ((agora) => () => agora() + 61 * 60 * 1000)(Date.now)", sw.ctx);
    const r3 = await sw.mensagem({ tipo: "preparar-sem-sinal" });
    expect(r3[1]).toMatchObject({ guardadas: TELAS_PRINCIPAIS.length });

    const c = await caches.open("crm-nh-v1");
    expect(await c.match("/_next/static/chunks/app/(app)/layout-1.js")).toBeTruthy();
    expect(await c.match("/_next/static/chunks/app/(app)/pagina/[id]/page-1.js")).toBeTruthy();

    rede.offline = true;
    for (const t of TELAS_PRINCIPAIS) {
      const res = await sw.navegar(t);
      expect(await res!.text(), t).toContain(`Tela ${t}`);
    }
  });

  it("sem internet, a raiz abre a cópia do Dashboard (é por onde o app começa)", async () => {
    const sw = await workerPronto();
    await sw.mensagem({ tipo: "preparar-sem-sinal" });
    rede.offline = true;
    const res = await sw.navegar("/");
    expect(await res!.text()).toContain("Tela /dashboard");
  });

  it("tela sem cópia vai para o modo sem sinal dizendo por quê", async () => {
    const sw = await workerPronto();
    rede.offline = true;
    const semCopia = await sw.navegar("/clientes/nunca_aberto");
    expect(semCopia!.status).toBe(302);
    expect(semCopia!.headers.get("location")).toBe(`${ORIGEM}/sem-sinal?de=%2Fclientes%2Fnunca_aberto&motivo=sem-copia`);

    const aoVivo = await sw.navegar("/atendimento");
    expect(aoVivo!.headers.get("location")).toBe(`${ORIGEM}/sem-sinal?de=%2Fatendimento&motivo=nao-guarda`);

    // E a própria tela do modo sem sinal abre do guardado.
    const ss = await sw.navegar("/sem-sinal?de=%2Fatendimento&motivo=nao-guarda");
    expect(await ss!.text()).toContain("Modo sem sinal");
  });

  it("o WhatsApp não vira cópia nem aberto com internet", async () => {
    const sw = await workerPronto();
    await sw.navegar("/atendimento");
    const c = await caches.open("crm-nh-v1");
    expect(await c.match("/atendimento")).toBeUndefined();
  });

  it("tela com erro (banco fora, pedaço que caiu) não toma o lugar da cópia boa", async () => {
    const sw = await workerPronto();
    await sw.navegar("/clientes");
    rede.paginas.set("/clientes", { html: paginaHtml("O banco não respondeu", { marca: false }) });
    vm.runInContext("Date.now = ((agora) => () => agora() + 2 * 60 * 60 * 1000)(Date.now)", sw.ctx);
    await sw.navegar("/clientes");
    rede.paginas.set("/clientes", { html: paginaHtml("Clientes pela metade", { extra: "<script>$RX=function(){}</script>" }) });
    const r = await sw.mensagem({ tipo: "guardar-tela", caminho: "/clientes" });
    expect(r[0]).toMatchObject({ tipo: "telas-guardadas", guardadas: 0 });
    expect(String((r[0].falhas as string[])[0])).toMatch(/erro/);

    rede.offline = true;
    const res = await sw.navegar("/clientes");
    expect(await res!.text()).toContain("Tela /clientes");
  });

  it("endereço com filtro não vira cópia (não troca a lista inteira pela filtrada)", async () => {
    const sw = await workerPronto();
    await sw.navegar("/dashboard?ano=2025");
    const c = await caches.open("crm-nh-v1");
    expect(await c.match("/dashboard")).toBeUndefined();
  });

  it("sessão vencida: não guarda a tela de login no lugar e diz o motivo", async () => {
    for (const k of [...rede.paginas.keys()]) rede.paginas.set(k, { html: "", redirecionaPara: "/login" });
    const sw = await workerPronto();
    const r = await sw.mensagem({ tipo: "preparar-sem-sinal", forcar: true });
    expect(r[0]).toMatchObject({ tipo: "sem-sinal-preparado", ok: false });
    expect(String(r[0].motivo)).toMatch(/sessão/);
    expect(r[1].falhas).toHaveLength(TELAS_PRINCIPAIS.length);
    const c = await caches.open("crm-nh-v1");
    expect(await c.match("/sem-sinal")).toBeUndefined();
    expect(await c.match("/dashboard")).toBeUndefined();

    // Sem a tela guardada, sem internet: a página que explica, não o erro do navegador.
    rede.offline = true;
    const res = await sw.navegar("/dashboard");
    expect(res!.status).toBe(503);
    expect(await res!.text()).toContain("ainda não guardou o modo sem sinal");
  });

  it("teto de cópias: as principais ficam, das avulsas saem as mais velhas", async () => {
    const sw = await workerPronto();
    await sw.mensagem({ tipo: "preparar-sem-sinal" });
    const avulsas = MAX_TELAS_GUARDADAS - TELAS_PRINCIPAIS.length + 5;
    for (let i = 0; i < avulsas; i++) {
      rede.paginas.set(`/clientes/c${i}`, { html: paginaHtml(`Cliente ${i}`) });
      await sw.mensagem({ tipo: "guardar-tela", caminho: `/clientes/c${i}` });
    }
    const c = await caches.open("crm-nh-v1");
    const telas: string[] = [];
    for (const k of await c.keys()) {
      const r = await c.match(k);
      if (r?.headers.get("x-tela")) telas.push(new URL(k.url).pathname);
    }
    expect(telas.length).toBe(MAX_TELAS_GUARDADAS);
    for (const t of TELAS_PRINCIPAIS) expect(telas).toContain(t);
    // As 5 primeiras avulsas (as mais velhas) saíram.
    for (let i = 0; i < 5; i++) expect(telas).not.toContain(`/clientes/c${i}`);
    expect(telas).toContain(`/clientes/c${avulsas - 1}`);
  });

  it("versão nova no ar: a antiga fica até a nova ter tudo guardado", async () => {
    const v1 = await workerPronto("v1");
    await v1.mensagem({ tipo: "preparar-sem-sinal" });

    // Deploy novo instalando sem internet (celular na rua): nada guardado na v2.
    rede.offline = true;
    const v2 = carregarWorker("v2", caches);
    await v2.ciclo("install");
    await v2.ciclo("activate");
    expect(await caches.keys()).toContain("crm-nh-v1");
    const res = await v2.navegar("/clientes");
    expect(await res!.text()).toContain("Tela /clientes");

    // Com internet de novo, a v2 guarda tudo e a v1 sai.
    rede.offline = false;
    const r = await v2.mensagem({ tipo: "preparar-sem-sinal" });
    expect(r[1]).toMatchObject({ falhas: [] });
    expect(await caches.keys()).toEqual(["crm-nh-v2"]);
  });

  it("tela principal que falha no servidor aparece como falha, com o motivo", async () => {
    rede.paginas.set("/alertas", { html: "erro", status: 500 });
    const sw = await workerPronto();
    const r = await sw.mensagem({ tipo: "preparar-sem-sinal" });
    expect(r[1].falhas).toEqual(["/alertas: o servidor respondeu 500"]);
    expect(r[1].guardadas).toBe(TELAS_PRINCIPAIS.length - 1);
  });
});
