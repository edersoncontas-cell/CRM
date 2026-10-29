// e2e do mapa por região (Visitas e Dashboard) — PC 1440 e celular 390, tema claro e escuro.
//
// O que prova (contra o build de PRODUÇÃO, `next start`): divisa preta, cinza escuro, preenchimento opaco (a base
// do mapa não aparece por baixo — o azulejo falso tem ruas, rios e NOMES de cidade), contorno do estado, nomes
// escritos dentro das cidades (inteiros, fora de pin/cifrão, caixa = a medida, `display:flex`), aproximar só
// acrescenta nomes, a dica (inteira dentro do mapa em todas as bordas; no celular fica aberta até o próximo toque),
// o realce que sobrevive à atualização do mapa e o estado "nenhuma cidade atendida". Roteiro e como rodar: README.md.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const BASE = process.env.E2E_BASE || "http://localhost:3210";
const OUT = path.resolve(process.env.E2E_OUT || "/tmp/mapa-e2e") + path.sep; // onde ficam o azulejo falso e as fotos (com ou sem "/" no fim)
const CHROMIUM = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PSQL = process.env.E2E_PSQL || `su postgres -c "psql -p 5433 -d crmgoogle -At -v ON_ERROR_STOP=1"`;
const SENHA = process.env.E2E_SENHA; // a senha do CRM de TESTE (banco local descartável) — nunca a de produção
if (!SENHA) { console.error("Defina E2E_SENHA (a senha do CRM de teste). Veja scripts/e2e-mapa/README.md."); process.exit(2); }
const BANCO = process.env.E2E_BANCO; // o NOME do banco de teste: o roteiro grava e apaga dados, então só roda se o banco do PSQL tiver este nome
if (!BANCO) { console.error("Defina E2E_BANCO com o nome do banco de TESTE (o roteiro grava e apaga dados nele). Veja scripts/e2e-mapa/README.md."); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
if (!fs.existsSync(path.join(OUT, "tile-osm.png"))) { console.error(`Falta o azulejo falso em ${OUT}tile-osm.png. Gere com: E2E_OUT=${OUT} node scripts/e2e-mapa/gerar-tile.cjs`); process.exit(2); }
const TILE = fs.readFileSync(path.join(OUT, "tile-osm.png"));
const sql = (q) => execSync(PSQL, { input: q }).toString().trim();
const setConfig = (chave, obj) => sql(`INSERT INTO "Configuracao"(chave, valor) VALUES ('${chave}', $j$${typeof obj === "string" ? obj : JSON.stringify(obj)}$j$) ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;`);
const delConfig = (chave) => sql(`DELETE FROM "Configuracao" WHERE chave='${chave}';`);
const resultados = [];
const check = (nome, ok, extra = "") => { resultados.push({ nome, ok: !!ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${nome}${ok ? "" : "  <<< " + extra}`); };
const info = (t) => console.log(`      · ${t}`);

// O roteiro mexe no banco de teste (lista de cidades atendidas, "fora de área" dos municípios, dados do mapa).
// Guarda o que havia ANTES e devolve no fim — também quando o roteiro quebra no meio (bloco finally / SIGINT).
const b64 = (txt) => Buffer.from(txt, "utf8").toString("base64");
let guardado = null;
// O que havia antes também fica GRAVADO no banco de teste (chave reserva): se o roteiro morrer sem passar pelo
// `finally` (kill -9, queda de energia), a próxima execução devolve o estado verdadeiro em vez de tratar o estado
// sujo da execução anterior como se fosse o original.
const CHAVE_RESERVA = "e2e.mapa.original";
const lerConfig = (chave) => {
  const b = sql(`SELECT encode(convert_to(valor, 'UTF8'), 'base64') FROM "Configuracao" WHERE chave = '${chave}';`).replace(/\s+/g, "");
  return b ? Buffer.from(b, "base64").toString("utf8") : null;
};
function devolver(g) {
  if (g.area !== null) setConfig("area.atuacao", g.area); else delConfig("area.atuacao");
  sql(`UPDATE "Municipio" SET "foraDeArea" = true; ${g.dentro.length ? `UPDATE "Municipio" SET "foraDeArea" = false WHERE id IN (${g.dentro.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")});` : ""}`);
}
function guardarBanco() {
  const banco = sql("SELECT current_database();");
  if (banco !== BANCO) { console.error(`O banco do PSQL é "${banco}", não "${BANCO}" (E2E_BANCO). Nada foi gravado.`); process.exit(2); }
  const sobra = lerConfig(CHAVE_RESERVA);
  if (sobra) {
    console.log("Achei o estado guardado por uma execução anterior que não terminou: devolvo ele ao banco antes de começar.");
    devolver(JSON.parse(sobra));
    delConfig(CHAVE_RESERVA);
  }
  const dentro = sql(`SELECT id FROM "Municipio" WHERE "foraDeArea" = false;`).split("\n").filter(Boolean);
  guardado = { area: lerConfig("area.atuacao"), dentro };
  setConfig(CHAVE_RESERVA, guardado);
}
function restaurarBanco() {
  if (!guardado) return;
  const g = guardado; guardado = null;
  devolver(g);
  delConfig(CHAVE_RESERVA);
}
process.on("SIGINT", () => { try { restaurarBanco(); } finally { process.exit(130); } });
process.on("SIGTERM", () => { try { restaurarBanco(); } finally { process.exit(143); } });

const PC = { width: 1440, height: 900 };
const CEL = { width: 390, height: 844 };
const CINZA = "#555c68";
const ATENDO = ["Irupi","Guaçuí","Iúna","Ibitirama","Divino de São Lourenço","Dores do Rio Preto","Anchieta","Piúma","Itapemirim","Marataízes","Cachoeiro de Itapemirim","Castelo","Mimoso do Sul","Presidente Kennedy","Rio Novo do Sul","Iconha","Muqui","Atílio Vivácqua","Jerônimo Monteiro","Alegre","Bom Jesus do Norte","Vargem Alta","Domingos Martins","Marechal Floriano","Alfredo Chaves","Venda Nova do Imigrante","Muniz Freire","Conceição do Castelo","Ibatiba","Brejetuba","Santa Maria de Jetibá","Santa Leopoldina","Afonso Cláudio","Itarana","Itaguaçu","Vitória","Vila Velha","Serra","Cariacica","Viana","Guarapari"];
const malha = JSON.parse(fs.readFileSync(path.join(__dirname, "../../src/lib/malha-es.json"), "utf8"));
const NOMES = malha.features.map((f) => f.properties.nome);

async function abrir(browser, vp, tema) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.width < 500 ? 2 : 1, isMobile: vp.width < 500, hasTouch: vp.width < 500 });
  await ctx.addCookies([{ name: "crm_tema", value: tema, url: BASE }]);
  const zooms = new Set();
  await ctx.route(/tile\.openstreetmap\.org/, (r) => { const m = r.request().url().match(/\/(\d+)\/\d+\/\d+\.png/); if (m) zooms.add(Number(m[1])); return r.fulfill({ status: 200, contentType: "image/png", body: TILE }); });
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await page.goto(BASE + "/login");
  await page.fill('input[name="senha"]', SENHA);
  await Promise.all([page.waitForURL(/dashboard/, { timeout: 30000 }).catch(() => {}), page.locator('form button[type="submit"], form button').first().click()]);
  await page.waitForTimeout(500);
  if (!/dashboard/.test(page.url())) throw new Error(`Não consegui entrar no CRM (parei em ${page.url()}): confira E2E_SENHA = o APP_PASSWORD do servidor de teste.`);
  return { ctx, page, erros, zooms };
}
// O lembrete "Visita feita?" (z-index 150) cobre o mapa inteiro em dia útil, depois do horário da primeira visita AGENDADA. O seed
// grava as visitas como REALIZADAS e ele não deveria aparecer; se aparecer (o seed mudou, ou o banco tem visitas agendadas de verdade),
// fecha — e se NÃO fechar o roteiro para aqui, em vez de medir um mapa coberto.
async function fecharLembrete(page) {
  const b = page.locator('[title^="Agora não"]');
  await b.first().waitFor({ state: "visible", timeout: 800 }).catch(() => {});
  if (await b.count()) { await b.first().click({ force: true }).catch(() => {}); await page.waitForTimeout(300); }
  if (await b.count()) throw new Error('O lembrete "Visita feita?" está cobrindo a tela e não fechou: o mapa não pode ser conferido.');
}

// Lê os pixels de um PNG dentro do navegador (o Pillow deste ambiente está quebrado).
async function amostrar(aux, png, pts) {
  return aux.evaluate(async ({ b64, pts }) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    return pts.map(([x, y]) => Array.from(g.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)));
  }, { b64: png.toString("base64"), pts });
}
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// Que fração dos pixels de cada caixa difere da cor de fundo esperada (> 60 em algum canal)? É a prova de que o nome está PINTADO na
// tela: o texto existe no DOM mesmo com z-index errado, opacity 0 ou cor igual à da cidade — só os pixels contam a verdade.
async function fracoesDeTinta(aux, png, itens) {
  return aux.evaluate(async ({ b64, itens }) => {
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
    return itens.map(({ x, y, w, h, fill }) => {
      const d = g.getImageData(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))).data;
      let dif = 0, tot = 0;
      for (let i = 0; i < d.length; i += 4) { tot++; if (Math.max(Math.abs(d[i] - fill[0]), Math.abs(d[i + 1] - fill[1]), Math.abs(d[i + 2] - fill[2])) > 60) dif++; }
      return dif / tot;
    });
  }, { b64: png.toString("base64"), itens });
}
// Cada nome à vista (inteiro dentro da janela): a caixa do texto e a cor de preenchimento da PRÓPRIA cidade.
const caixasDosNomes = (page) => page.evaluate((NOMES) => {
  const saida = [];
  for (const el of document.querySelectorAll(".rotulo-municipio")) {
    const span = el.querySelector("span"); if (!span) continue;
    const nome = span.innerText.replace(/\n/g, " "), r = span.getBoundingClientRect();
    if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) continue;
    const path = document.querySelector(`.leaflet-municipios-pane path[data-i="${NOMES.indexOf(nome)}"]`);
    if (path) saida.push({ nome, x: r.left, y: r.top, w: r.width, h: r.height, fill: path.getAttribute("fill") });
  }
  return saida;
}, NOMES);
async function medirNomesPintados(page, aux) {
  const dsf = page.viewportSize().width < 500 ? 2 : 1;
  const caixas = await caixasDosNomes(page);
  const png = await page.screenshot();
  const f = await fracoesDeTinta(aux, png, caixas.map((c) => ({ x: c.x * dsf, y: c.y * dsf, w: c.w * dsf, h: c.h * dsf, fill: rgb(c.fill) })));
  const semTinta = caixas.filter((_, i) => f[i] < 0.04).map((c) => c.nome);
  return { n: caixas.length, minimo: f.length ? Math.min(...f) : 0, semTinta };
}


// Pontos DENTRO de cada cidade (longe da divisa, e de pin/cifrão: elementFromPoint tem de ser a própria cidade).
const pontosDentro = (page, maxCidades, porCidade) => page.evaluate(({ maxCidades, porCidade }) => {
  const paths = [...document.querySelectorAll(".leaflet-municipios-pane path")];
  const vw = innerWidth, vh = innerHeight, saida = [];
  const grandes = paths.map((p, i) => ({ p, i, r: p.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 24 && r.height > 24 && r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh)
    .sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height).slice(0, maxCidades);
  for (const { p, r } of grandes) {
    let n = 0;
    for (let x = Math.max(r.x, 2); x < Math.min(r.right, vw - 2) && n < porCidade; x += 7) {
      for (let y = Math.max(r.y, 2); y < Math.min(r.bottom, vh - 2) && n < porCidade; y += 7) {
        if (document.elementFromPoint(x, y) !== p) continue;
        if ([[8, 0], [-8, 0], [0, 8], [0, -8], [6, 6], [-6, 6], [6, -6], [-6, -6], [3, 0], [-3, 0], [0, 3], [0, -3]].some(([dx, dy]) => document.elementFromPoint(x + dx, y + dy) !== p)) continue;
        saida.push({ x, y, fill: p.getAttribute("fill") }); n++;
      }
    }
  }
  return saida;
}, { maxCidades, porCidade });

// Cada nome escrito: todos os pontos do retângulo caem na PRÓPRIA cidade (não numa vizinha, não num pin).
const conferirNomesDentro = (page) => page.evaluate((NOMES) => {
  const paths = [...document.querySelectorAll(".leaflet-municipios-pane path")];
  const mapaR = document.querySelector(".leaflet-container").getBoundingClientRect();
  const rotulos = [...document.querySelectorAll(".rotulo-municipio")];
  const pins = [...document.querySelectorAll(".leaflet-marker-icon:not(.rotulo-municipio)")].map((e) => e.getBoundingClientRect());
  const botoes = [...document.querySelectorAll(".leaflet-control")].map((e) => e.getBoundingClientRect());
  const problemas = [];
  const fontes = new Set();
  const vw = innerWidth, vh = innerHeight;
  let conferidos = 0;
  for (const el of rotulos) {
    const span = el.querySelector("span"), r = span.getBoundingClientRect();
    const nome = span.innerText.replace(/\n/g, " ");
    fontes.add(parseFloat(getComputedStyle(span).fontSize));
    if (r.right < 0 || r.left > vw || r.bottom < 0 || r.top > vh) continue;
    conferidos++;
    if (r.left < mapaR.left - 0.5 || r.right > mapaR.right + 0.5 || r.top < mapaR.top - 0.5 || r.bottom > mapaR.bottom + 0.5) problemas.push(`${nome}: cortado pela borda do mapa`);
    for (const pin of pins) if (r.left < pin.right && r.right > pin.left && r.top < pin.bottom && r.bottom > pin.top) problemas.push(`${nome}: embaixo de um pin/cifrão`);
    for (const b of botoes) if (r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top) problemas.push(`${nome}: embaixo de um botão do mapa (+/−, créditos)`);
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 2; j++) {
      const x = r.left + 1 + ((r.width - 2) * i) / 8, y = r.top + 1 + ((r.height - 2) * j) / 2;
      if (x < 0 || y < 0 || x > vw || y > vh) continue;
      const topo = document.elementFromPoint(x, y);
      if (topo && topo.closest(".leaflet-marker-icon") && !topo.closest(".rotulo-municipio")) { problemas.push(`${nome}: pin por cima`); continue; }
      if (topo && topo.closest(".leaflet-popup")) continue; // o balão de um pin aberto cobre o mapa: fora da conferência
      const idx = topo && topo.getAttribute ? Number(topo.getAttribute("data-i") ?? -1) : -1;
      if (!(idx >= 0) || NOMES[idx] !== nome) problemas.push(`${nome}: ponto ${Math.round(x)},${Math.round(y)} cai em ${!(idx >= 0) ? (topo ? topo.tagName + "." + topo.className : "nada") : NOMES[idx]}`);
    }
  }
  return { qtd: rotulos.length, conferidos, problemas: [...new Set(problemas)], fontes: [...fontes], pins: pins.length, botoes: botoes.length };
}, NOMES);


// A caixa de cada nome é a que a conta mediu: display flex (o leaflet.css põe block e vencia), o texto
// inteiro dentro do ícone e cada linha com a altura de linha que o próprio CSS do nome declara (lida da tela, não
// repetida aqui); a caixa é o texto + 2 x 2 px de folga em cima e embaixo.
const conferirLayoutDosNomes = (page) => page.evaluate(() => {
  const problemas = [];
  let n = 0, duasLinhas = 0;
  for (const el of document.querySelectorAll(".rotulo-municipio")) {
    const span = el.querySelector("span"); if (!span) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(), s = span.getBoundingClientRect();
    const nome = span.innerText.replace(/\n/g, " ");
    n++;
    if (cs.display !== "flex") problemas.push(`${nome}: display ${cs.display} (esperado flex)`);
    const linhaPx = parseFloat(getComputedStyle(span).lineHeight);
    if (!(linhaPx > 0)) { problemas.push(`${nome}: sem altura de linha declarada`); continue; }
    const linhas = span.innerHTML.split("<br>").length;
    if (linhas === 2) duasLinhas++;
    if (Math.abs(s.height - linhas * linhaPx) > 1) problemas.push(`${nome}: texto com ${s.height.toFixed(1)} px de altura, esperado ${linhas * linhaPx}`);
    if (Math.abs(r.height - (linhas * linhaPx + 4)) > 1) problemas.push(`${nome}: caixa com ${r.height.toFixed(1)} px de altura, esperado ${linhas * linhaPx + 4} (texto + 2 x 2 px de folga)`);
    if (s.top < r.top - 0.6 || s.bottom > r.bottom + 0.6 || s.left < r.left - 0.6 || s.right > r.right + 0.6) problemas.push(`${nome}: texto vaza da caixa medida (texto ${s.top.toFixed(1)}..${s.bottom.toFixed(1)}, caixa ${r.top.toFixed(1)}..${r.bottom.toFixed(1)})`);
    // Centrado na caixa: folga em cima ≈ folga embaixo.
    if (Math.abs((s.top - r.top) - (r.bottom - s.bottom)) > 1.2) problemas.push(`${nome}: texto fora do centro da caixa`);
  }
  return { n, duasLinhas, problemas: [...new Set(problemas)] };
});

// Dicas nas bordas do mapa: a dica inteira tem de ficar dentro do contêiner do mapa (ele corta o que passa).
async function conferirDicasNasBordas(page, T, toque, nome) {
  const pontos = await page.evaluate(() => {
    const mapa = document.querySelector(".leaflet-container"), R = mapa.getBoundingClientRect();
    const vw = innerWidth, vh = innerHeight, achados = [];
    for (let x = Math.max(R.left, 0) + 4; x < Math.min(R.right, vw) - 3; x += 6) for (let y = Math.max(R.top, 0) + 4; y < Math.min(R.bottom, vh) - 3; y += 6) {
      const el = document.elementFromPoint(x, y);
      if (el && el.tagName === "path" && el.closest(".leaflet-municipios-pane")) achados.push([x, y]);
    }
    const por = (f) => achados.length ? achados.reduce((m, p) => (f(p) < f(m) ? p : m)) : null;
    const meioV = (p) => p[1] > R.top + 90 && p[1] < R.bottom - 90;
    const noMeio = achados.filter(meioV);
    const esq = noMeio.length ? noMeio.reduce((m, p) => (p[0] < m[0] ? p : m)) : null;
    const dir = noMeio.length ? noMeio.reduce((m, p) => (p[0] > m[0] ? p : m)) : null;
    const pt = (p) => (p ? { x: p[0], y: p[1] } : null);
    return {
      mapa: { l: R.left, t: R.top, r: R.right, b: R.bottom },
      topo: pt(por((p) => p[1] * 1000 + Math.abs(p[0] - (R.left + R.right) / 2))),
      esquerda: pt(esq), direita: pt(dir),
      cantoSupDir: pt(por((p) => (p[1] - R.top) + (R.right - p[0]))),
      cantoSupEsq: pt(por((p) => (p[1] - R.top) + (p[0] - R.left))),
    };
  });
  const R = pontos.mapa;
  for (const lado of ["topo", "esquerda", "direita", "cantoSupDir", "cantoSupEsq"]) {
    const p = pontos[lado];
    if (!p) { info(`${T}: sem cidade encostada em ${lado} para testar a dica`); continue; }
    if (toque) await page.touchscreen.tap(p.x, p.y); else await page.mouse.move(p.x, p.y);
    await page.waitForTimeout(450);
    const nTips = await page.locator(".leaflet-tooltip:visible").count();
    if (nTips !== 1) check(`${T}: ${lado}: exatamente UMA dica aberta`, false, String(nTips));
    const tip = page.locator(".leaflet-tooltip:visible").last();
    const tb = (await tip.count()) ? await tip.boundingBox() : null;
    const dentro = !!tb && tb.x >= R.l - 1 && tb.x + tb.width <= R.r + 1 && tb.y >= R.t - 1 && tb.y + tb.height <= R.b + 1;
    const cls = tb ? await tip.getAttribute("class") : "";
    check(`${T}: dica ${toque ? "tocada" : "sob o mouse"} em ${lado} (${Math.round(p.x - R.l)},${Math.round(p.y - R.t)}) cabe INTEIRA no mapa`, dentro, tb ? `dica ${Math.round(tb.x - R.l)}..${Math.round(tb.x + tb.width - R.l)} x ${Math.round(tb.y - R.t)}..${Math.round(tb.y + tb.height - R.t)} no mapa ${Math.round(R.r - R.l)}x${Math.round(R.b - R.t)} (${cls})` : "sem dica");
    // Os controles do Leaflet (+/−, créditos) ficam POR CIMA da dica: se ela cair embaixo de um, o começo do nome some.
    const sobControle = await page.evaluate((tbx) => [...document.querySelectorAll(".leaflet-control")].some((e) => { const c = e.getBoundingClientRect(); return tbx && tbx.x < c.right - 0.5 && tbx.x + tbx.width > c.left + 0.5 && tbx.y < c.bottom - 0.5 && tbx.y + tbx.height > c.top + 0.5; }), tb);
    check(`${T}: dica em ${lado} NÃO cai embaixo do +/− nem dos créditos`, !!tb && !sobControle, tb ? JSON.stringify(tb) : "sem dica");
    // A seta fica no meio da dica por padrão; com a dica deslocada, --seta a traz de volta para o dedo (presa a 14 px das pontas).
    // `left`/`top` do ::before contam a partir da borda de DENTRO da dica (a caixa de padding): soma a borda (clientLeft/Top) à posição.
    const seta = tb ? await tip.evaluate((el) => { const cs = getComputedStyle(el, "::before"), r = el.getBoundingClientRect(); return { cls: el.className, esq: parseFloat(cs.left), topo: parseFloat(cs.top), bx: el.clientLeft, by: el.clientTop, cw: el.clientWidth, ch: el.clientHeight, x: r.x, y: r.y }; }) : null;
    if (seta) {
      const vertical = /leaflet-tooltip-(top|bottom)/.test(seta.cls);
      const centro = vertical ? seta.x + seta.bx + seta.esq : seta.y + seta.by + seta.topo;
      const dedo = vertical ? p.x : p.y;
      const preso = vertical ? seta.esq <= 14.5 || seta.esq >= seta.cw - 14.5 : seta.topo <= 14.5 || seta.topo >= seta.ch - 14.5;
      check(`${T}: a seta da dica em ${lado} aponta para o dedo (${Math.abs(centro - dedo).toFixed(1)} px${preso ? ", presa na ponta da dica" : ""})`, Math.abs(centro - dedo) <= 3 || preso, `seta em ${centro.toFixed(1)}, dedo em ${dedo.toFixed(1)} (${seta.cls})`);
    }
    if (lado === "cantoSupDir" || lado === "topo") await page.screenshot({ path: `${OUT}n-${nome}-dica-${lado}.png`, clip: { x: R.l, y: Math.max(0, R.t), width: R.r - R.l, height: Math.min(R.b - R.t, 300) } });
    if (toque) await page.touchscreen.tap(2, 2); else await page.mouse.move(2, 2);
    await page.waitForTimeout(150);
  }
}


// Toque no celular: a dica abre e FICA; tocar em outra cidade troca (nunca duas ao mesmo tempo); afastar o mapa fecha.
async function conferirToqueDaDica(page, T) {
  const hoverNone = await page.evaluate(() => matchMedia("(hover: none)").matches);
  check(`${T}: o navegador em modo celular diz (hover: none) — o código de toque vale`, hoverNone, String(hoverNone));
  const dois = await page.evaluate(() => {
    const R = document.querySelector(".leaflet-container").getBoundingClientRect();
    const vistos = new Map();
    for (let x = R.left + 50; x < R.right - 50; x += 8) for (let y = Math.max(R.top, 0) + 100; y < Math.min(R.bottom, innerHeight) - 50; y += 8) {
      const el = document.elementFromPoint(x, y);
      if (el && el.tagName === "path" && el.closest(".leaflet-municipios-pane")) { const i = Number(el.getAttribute("data-i")); if (!vistos.has(i)) vistos.set(i, [x, y]); }
    }
    const lista = [...vistos.entries()];
    return lista.length >= 2 ? [lista[0], lista[lista.length - 1]] : null;
  });
  if (!dois) { check(`${T}: há duas cidades para tocar`, false, "menos de 2"); return; }
  const visiveis = () => page.locator(".leaflet-tooltip:visible");
  const [[iA, pA], [iB, pB]] = dois;
  await page.touchscreen.tap(pA[0], pA[1]);
  await page.waitForTimeout(1200);
  const nA = await visiveis().count(); const tA = nA ? await visiveis().first().innerText() : "";
  check(`${T}: tocar numa cidade abre a dica e ELA FICA aberta (1,2 s depois)`, nA === 1 && tA.includes(NOMES[iA]), `${nA} dica(s): ${tA}`);
  await page.touchscreen.tap(pB[0], pB[1]);
  await page.waitForTimeout(900);
  const nB = await visiveis().count(); const tB = nB ? await visiveis().first().innerText() : "";
  check(`${T}: tocar em OUTRA cidade troca a dica (uma só, a nova)`, nB === 1 && tB.includes(NOMES[iB]) && !tB.includes(NOMES[iA]), `${nB} dica(s): ${tB}`);
  await page.locator(".leaflet-control-zoom-out").first().tap();
  await page.waitForTimeout(1200);
  check(`${T}: afastar o mapa fecha a dica`, (await visiveis().count()) === 0, String(await visiveis().count()));
}

async function esperarRotulos(page) { await page.waitForSelector('.leaflet-container[data-rotulos="ok"]', { timeout: 20000 }); await page.waitForTimeout(500); }

async function conferirMapa(page, aux, rotulo, secao, nome, zooms) {
  // O ponteiro do Playwright fica parado onde esteve. Se ele estiver sobre uma cidade quando a página abre, o realce
  // (bringToFront) reordena o DOM ANTES de numerar os caminhos com data-i — e o índice passa a apontar para a cidade errada.
  await page.mouse.move(2, 2);
  await page.goto(BASE + secao.url, { waitUntil: "domcontentloaded" });
  await fecharLembrete(page);
  const mapa = page.locator(".leaflet-container").first();
  await mapa.waitFor({ timeout: 30000 });
  await page.waitForSelector(".leaflet-municipios-pane path", { timeout: 20000 });
  await esperarRotulos(page);
  await page.evaluate(() => document.querySelectorAll(".leaflet-municipios-pane path").forEach((p, i) => p.setAttribute("data-i", String(i))));
  await mapa.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const T = `${rotulo} ${nome}`;

  // ── estilo (atributos SVG)
  const caminhos = await page.$$eval(".leaflet-municipios-pane path", (ps) => ps.map((p) => ({ fill: (p.getAttribute("fill") || "").toLowerCase(), fo: p.getAttribute("fill-opacity"), stroke: (p.getAttribute("stroke") || "").toLowerCase(), so: p.getAttribute("stroke-opacity"), sw: p.getAttribute("stroke-width") })));
  check(`${T}: 78 municípios desenhados`, caminhos.length === 78, caminhos.length);
  const cinzas = caminhos.filter((c) => c.fill === CINZA).length;
  check(`${T}: ${ATENDO.length} atendidas coloridas e ${78 - ATENDO.length} em cinza ESCURO (${CINZA})`, cinzas === 78 - ATENDO.length && caminhos.filter((c) => c.fill !== CINZA).length === ATENDO.length, `cinza=${cinzas}`);
  check(`${T}: nenhum cinza claro de antes (#9ca3af)`, !caminhos.some((c) => c.fill === "#9ca3af"));
  check(`${T}: preenchimento OPACO em todas (fill-opacity 1)`, caminhos.every((c) => c.fo === "1"), JSON.stringify(caminhos.find((c) => c.fo !== "1")));
  check(`${T}: divisa PRETA em todas (#000000, opacidade 1)`, caminhos.every((c) => c.stroke === "#000000" && c.so === "1"), JSON.stringify(caminhos.find((c) => c.stroke !== "#000000")));
  check(`${T}: usa as cores de várias regiões`, new Set(caminhos.filter((c) => c.fill !== CINZA).map((c) => c.fill)).size >= 6);
  const base = await page.$$eval(".leaflet-estado-base-pane path", (ps) => ps.map((p) => [p.getAttribute("stroke"), p.getAttribute("stroke-width"), p.getAttribute("fill")]));
  check(`${T}: contorno grosso do estado por baixo (78 traços de 4 px, sem preenchimento)`, base.length === 78 && base.every(([s, w, f]) => s === "#000000" && w === "4" && f === "none"), JSON.stringify(base[0]));
  const leg = page.locator('[data-mapa-legenda="ok"]').first();
  check(`${T}: legenda "Você atende ${ATENDO.length} de 78 cidades"`, (await leg.count()) === 1 && new RegExp(`atende ${ATENDO.length} de 78`).test(await leg.innerText()), await leg.innerText().catch(() => ""));

  // ── nomes dentro das cidades
  const zoom = await page.locator(".leaflet-container").first().getAttribute("data-rotulos-zoom");
  const n1 = await conferirNomesDentro(page);
  info(`${T}: zoom ~${zoom}; ${n1.qtd} nomes escritos de 78 (${n1.conferidos} à vista); letras ${n1.fontes.sort().join("/")}px`);
  check(`${T}: aparecem nomes dentro das cidades`, n1.qtd >= 1, n1.qtd);
  check(`${T}: o atributo do mapa bate com os nomes na tela`, (await page.locator(".leaflet-container").first().getAttribute("data-rotulos-qtd")) === String(n1.qtd));
  check(`${T}: todo nome está inteiro dentro da própria cidade e fora de pin/cifrão`, n1.problemas.length === 0, n1.problemas.slice(0, 4).join(" | "));
  check(`${T}: letra de 10 px ou mais`, n1.fontes.every((f) => f >= 10), n1.fontes.join(","));
  const lay1 = await conferirLayoutDosNomes(page);
  check(`${T}: caixa de cada nome = a medida (flex, ${lay1.n} nomes, ${lay1.duasLinhas} de duas linhas; texto dentro da caixa e centrado)`, lay1.problemas.length === 0, lay1.problemas.slice(0, 3).join(" | "));
  // O seed vale ONTEM? Sem pin/cifrão na tela "o nome fica fora de pin/cifrão" passaria vazio: afirma que existem.
  if (nome === "visitas") {
    const rota = await page.locator('.leaflet-overlay-pane path[stroke-dasharray="6 6"]').count();
    check(`${T}: há pins das visitas de hoje na tela (${n1.pins}) — senão a conferência "fora de pin" passa vazia`, n1.pins >= 5, String(n1.pins));
    check(`${T}: há o trajeto do dia (traço tracejado) na tela`, rota >= 1, String(rota));
  } else {
    check(`${T}: há cifrões de vendas na tela (${n1.pins}) — senão a conferência "fora de cifrão" passa vazia`, n1.pins >= 4, String(n1.pins));
  }
  check(`${T}: os botões do mapa (+/−, créditos) entram na conferência (${n1.botoes})`, n1.botoes >= 2, String(n1.botoes));
  const aviso = await page.locator(".rotulo-municipio").first().evaluate((e) => getComputedStyle(e).pointerEvents).catch(() => "none");
  check(`${T}: nome não rouba o toque (pointer-events none)`, aviso === "none", aviso);

  // ── dica ao passar o mouse / tocar numa cidade livre de pin
  const idx = NOMES.indexOf("Cachoeiro de Itapemirim");
  const alvo = page.locator(`.leaflet-municipios-pane path[data-i="${idx}"]`);
  await alvo.scrollIntoViewIfNeeded().catch(() => {});
  const ponto = await page.evaluate((i) => {
    const p = document.querySelector(`.leaflet-municipios-pane path[data-i="${i}"]`), r = p.getBoundingClientRect();
    for (const margem of [5, 2, 0]) {
      let m = null, md = Infinity; const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      for (let x = Math.max(r.x, 2); x < Math.min(r.right, innerWidth - 2); x += 2) for (let y = Math.max(r.y, 2); y < Math.min(r.bottom, innerHeight - 2); y += 2) {
        if (document.elementFromPoint(x, y) !== p) continue;
        if (margem && [[margem, 0], [-margem, 0], [0, margem], [0, -margem]].some(([dx, dy]) => document.elementFromPoint(x + dx, y + dy) !== p)) continue;
        const d = (x - cx) ** 2 + (y - cy) ** 2; if (d < md) { md = d; m = [x, y]; }
      }
      if (m) return m;
    }
    return null;
  }, idx);
  if (ponto) {
    await page.mouse.move(ponto[0], ponto[1]);
    await page.waitForTimeout(400);
    const tip = page.locator(".leaflet-tooltip").first();
    const txt = (await tip.count()) ? await tip.innerText() : "";
    check(`${T}: passar sobre Cachoeiro diz região e "você atende"`, /Cachoeiro de Itapemirim/.test(txt) && /Sul Capixaba/.test(txt) && /você atende/.test(txt), txt);
    const tb = await tip.boundingBox();
    check(`${T}: a dica cabe na tela`, !!tb && tb.x >= 0 && tb.x + tb.width <= page.viewportSize().width, JSON.stringify(tb));
    const larg = await alvo.evaluate((p) => ({ w: p.getAttribute("stroke-width"), fill: p.getAttribute("fill") }));
    check(`${T}: ao realçar, a divisa engrossa (3) e continua preta`, larg.w === "3", JSON.stringify(larg));
    await page.screenshot({ path: `${OUT}n-${nome}-${rotulo.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-dica.png` });
    if (nome === "dashboard") {
      // A cada foco da aba o mapa busca de novo e re-renderiza: o realce da cidade sob o mouse não pode sumir.
      const resp = page.waitForResponse((r) => /vendas-mapa/.test(r.url()), { timeout: 8000 }).catch(() => null);
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      const r1 = await resp;
      await page.waitForTimeout(700);
      const depois = await alvo.evaluate((p) => p.getAttribute("stroke-width"));
      check(`${T}: o realce (divisa 3) sobrevive à atualização do mapa (re-render do pai)`, !!r1 && depois === "3", `buscou=${!!r1} largura=${depois}`);
      check(`${T}: a dica continua aberta depois da atualização`, (await page.locator(".leaflet-tooltip:visible").count()) >= 1);
    }
    if (page.viewportSize().width < 500) {
      // Celular: a dica (aberta pelo "mouseover") fica aberta; um clique no mapa vazio (fora das cidades) a fecha.
      // É CLIQUE de mouse e não `touchscreen.tap` de propósito: o toque emulado do Chromium, no Leaflet, aproxima 1 nível
      // (conferido IGUAL no build anterior a esta mudança) e, com o ponteiro parado, a cidade que cai embaixo dele abre a
      // dica DELA — o que parece "não fechou". O toque tem as conferências próprias em conferirToqueDaDica.
      const vazio = await page.evaluate(() => {
        const R = document.querySelector(".leaflet-container").getBoundingClientRect();
        for (let x = R.left + 10; x < R.right - 10; x += 10) for (let y = Math.max(R.top, 0) + 10; y < Math.min(R.bottom, innerHeight) - 10; y += 10) {
          const el = document.elementFromPoint(x, y);
          if (el && el.tagName !== "path" && !el.closest(".leaflet-control, .leaflet-tooltip, .leaflet-marker-icon, .leaflet-popup")) return [x, y];
        }
        return null;
      });
      const antes = await page.locator(".leaflet-tooltip:visible").count();
      const zAntes = await page.locator(".leaflet-container").first().getAttribute("data-rotulos-zoom");
      if (vazio) { await page.mouse.click(vazio[0], vazio[1]); await page.waitForTimeout(700); }
      const zDepois = await page.locator(".leaflet-container").first().getAttribute("data-rotulos-zoom");
      check(`${T}: clicar no mapa VAZIO fecha a dica (estava aberta: ${antes}; zoom ${zAntes}→${zDepois})`, !!vazio && antes === 1 && (await page.locator(".leaflet-tooltip:visible").count()) === 0 && zAntes === zDepois, `vazio=${JSON.stringify(vazio)} antes=${antes} zoom ${zAntes}→${zDepois}`);
    }
    await page.mouse.move(2, 2);
  } else check(`${T}: Cachoeiro tem um ponto livre para tocar`, false, "sem ponto");
  const largura = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`${T}: sem rolagem lateral`, largura <= 1, largura);

  // ── foto do mapa (com a legenda)
  await mapa.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const arq = `${OUT}n-${nome}-${rotulo.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.png`;
  await mapa.locator("xpath=..").screenshot({ path: arq });

  // ── o que a tela PINTA (não o que o DOM diz): ordem das camadas, divisa e nomes de verdade visíveis
  const camadas = await page.evaluate(() => {
    const z = (c) => { const e = document.querySelector(c); return e ? parseInt(getComputedStyle(e).zIndex, 10) : NaN; };
    const op = (c) => { const e = document.querySelector(c); return e ? getComputedStyle(e).opacity : "?"; };
    return { estado: z(".leaflet-estado-base-pane"), cidades: z(".leaflet-municipios-pane"), nomes: z(".leaflet-rotulos-municipios-pane"), opacidades: [op(".leaflet-municipios-pane"), op(".leaflet-rotulos-municipios-pane")] };
  });
  check(`${T}: camadas na ordem estado < cidades < nomes (z-index lido da tela: ${camadas.estado} < ${camadas.cidades} < ${camadas.nomes})`, camadas.estado < camadas.cidades && camadas.cidades < camadas.nomes, JSON.stringify(camadas));
  check(`${T}: as camadas de cidades e de nomes estão opacas (opacity ${camadas.opacidades.join("/")})`, camadas.opacidades.every((o) => o === "1"), camadas.opacidades.join("/"));
  const pintado = await page.$$eval(".leaflet-municipios-pane path", (ps) => ps.map((p) => { const cs = getComputedStyle(p); return { stroke: cs.stroke, sw: parseFloat(cs.strokeWidth), so: cs.strokeOpacity, fo: cs.fillOpacity, op: cs.opacity, vis: cs.visibility }; }));
  const ruim = pintado.find((c) => c.stroke !== "rgb(0, 0, 0)" || c.so !== "1" || c.fo !== "1" || c.op !== "1" || c.vis !== "visible" || !(c.sw > 0.5));
  check(`${T}: o ESTILO CALCULADO da divisa é preto, opaco e visível em todas (um CSS por cima do atributo SVG também conta)`, !ruim, JSON.stringify(ruim));
  await page.mouse.move(2, 2);
  const pint = await medirNomesPintados(page, aux);
  info(`${T}: ${pint.n} nomes à vista; o que menos tem tinta: ${(pint.minimo * 100).toFixed(0)}% dos pixels`);
  check(`${T}: todo nome à vista está PINTADO na tela (≥ 4% dos pixels da caixa diferem da cor da cidade; ${pint.n} nomes)`, pint.n >= 1 && pint.semTinta.length === 0, `sem tinta: ${pint.semTinta.slice(0, 4).join(", ")}`);
  // Controle: com os nomes por BAIXO das cidades (z-index 345) a mesma medida TEM de achar nomes sem tinta.
  await page.evaluate(() => { document.querySelector(".leaflet-rotulos-municipios-pane").style.zIndex = "345"; });
  await page.waitForTimeout(150);
  const escondidos = await medirNomesPintados(page, aux);
  await page.evaluate((z) => { document.querySelector(".leaflet-rotulos-municipios-pane").style.zIndex = String(z); }, camadas.nomes);
  check(`${T}: [controle] com os nomes por baixo das cidades a medida enxerga ${escondidos.semTinta.length}/${escondidos.n} sem tinta`, escondidos.n >= 1 && escondidos.semTinta.length >= escondidos.n * 0.9, `sem tinta ${escondidos.semTinta.length}/${escondidos.n}`);

  // ── a base NÃO aparece por baixo da cor (azulejo sujo de ruas/rios/nomes)
  await page.addStyleTag({ content: ".rotulo-municipio{visibility:hidden !important} .leaflet-control{visibility:hidden !important} .leaflet-overlay-pane{visibility:hidden !important} .leaflet-tooltip{visibility:hidden !important}" });
  await page.mouse.move(2, 2);
  await page.waitForTimeout(200);
  const pinsR = await page.$$eval(".leaflet-marker-icon:not(.rotulo-municipio)", (es) => es.map((e) => { const r = e.getBoundingClientRect(); return [r.left - 24, r.top - 24, r.right + 24, r.bottom + 24]; }));
  const pts = (await pontosDentro(page, 14, 8)).filter((p) => !pinsR.some(([a, b, c, d]) => p.x > a && p.x < c && p.y > b && p.y < d));
  const dsf = page.viewportSize().width < 500 ? 2 : 1;
  const png = await page.screenshot();
  const px = await amostrar(aux, png, pts.map((p) => [p.x * dsf, p.y * dsf]));
  const dev = px.map((c, i) => Math.max(...c.map((v, k) => Math.abs(v - rgb(pts[i].fill)[k]))));
  const limpos = dev.filter((d) => d <= 3).length;
  for (let i = 0, k = 0; i < dev.length; i++) if (dev[i] > 3) {
    info(`   sujo em (${Math.round(pts[i].x)},${Math.round(pts[i].y)}) esperado ${pts[i].fill} obtido rgb(${px[i].join(",")})`);
    if (k++ < 2) await page.screenshot({ path: `${OUT}sujo-${nome}-${k}.png`, clip: { x: Math.max(0, pts[i].x - 60), y: Math.max(0, pts[i].y - 40), width: 120, height: 80 } });
  }
  check(`${T}: dentro das cidades só a cor (${limpos}/${pts.length} pontos sem nada da base)`, pts.length >= 20 && limpos / pts.length >= 0.98, `limpos=${limpos}/${pts.length}; pior=${Math.max(...dev)}`);
  // Controle: com o preenchimento de antes (0,8) o mesmo teste TEM de reclamar — prova que a medida enxerga a textura.
  await page.evaluate(() => document.querySelectorAll(".leaflet-municipios-pane path").forEach((p) => p.setAttribute("fill-opacity", "0.8")));
  await page.waitForTimeout(150);
  const png2 = await page.screenshot();
  const px2 = await amostrar(aux, png2, pts.map((p) => [p.x * dsf, p.y * dsf]));
  const dev2 = px2.map((c, i) => Math.max(...c.map((v, k) => Math.abs(v - rgb(pts[i].fill)[k]))));
  const sujos = dev2.filter((d) => d > 3).length;
  check(`${T}: [controle] com fill-opacity 0,8 a medida enxerga a base por baixo (${sujos}/${pts.length})`, sujos >= pts.length * 0.5, `sujos=${sujos}`);
  await page.evaluate(() => document.querySelectorAll(".leaflet-municipios-pane path").forEach((p) => p.setAttribute("fill-opacity", "1")));
  return n1.qtd;
}

async function aproximar(page, T, nome, rotuloArq) {
  // + do mapa: mais nomes aparecem e continuam todos dentro das cidades
  await page.evaluate(() => { const s = [...document.querySelectorAll("style")].filter((x) => x.textContent.includes(".rotulo-municipio{visibility:hidden")); s.forEach((x) => x.remove()); });
  const antes = Number(await page.locator(".leaflet-container").first().getAttribute("data-rotulos-qtd"));
  const mais = page.locator(".leaflet-control-zoom-in").first();
  await mais.click(); await page.waitForTimeout(900); await mais.click(); await page.waitForTimeout(1200);
  await esperarRotulos(page);
  const depois = Number(await page.locator(".leaflet-container").first().getAttribute("data-rotulos-qtd"));
  const n = await conferirNomesDentro(page);
  info(`${T}: ao aproximar 2 níveis: ${antes} → ${depois} nomes (${n.conferidos} à vista)`);
  check(`${T}: aproximar acrescenta nomes (${antes} → ${depois})`, depois > antes, `${antes}→${depois}`);
  check(`${T}: depois de aproximar todo nome continua dentro da própria cidade e fora de pin/cifrão`, n.problemas.length === 0, n.problemas.slice(0, 4).join(" | "));
  const lay = await conferirLayoutDosNomes(page);
  check(`${T}: depois de aproximar, a caixa de cada nome = a medida (${lay.n} nomes, ${lay.duasLinhas} de duas linhas)`, lay.problemas.length === 0, lay.problemas.slice(0, 3).join(" | "));
  await page.locator(".leaflet-container").first().screenshot({ path: `${OUT}n-${nome}-${rotuloArq}-zoom.png` });
  await conferirDicasNasBordas(page, T, page.viewportSize().width < 500, `${nome}-${rotuloArq}`);
  if (page.viewportSize().width < 500) await conferirToqueDaDica(page, T);
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  let falhou = false;
  try {
    // O CRM cria a estrutura num banco VAZIO na primeira requisição que passa pelo layout do app (entrar + abrir uma tela). Faz isso antes
    // de guardar o estado, senão o primeiro SELECT em Configuracao falha em banco recém-criado.
    const preparo = await abrir(browser, PC, "escuro");
    await preparo.page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
    await preparo.ctx.close();
    guardarBanco();
    // Os dados do mapa (pins das visitas DE HOJE, cifrões das vendas): o seed usa o dia de hoje — roda a cada vez.
    sql(fs.readFileSync(path.join(__dirname, "mapa-seed.sql"), "utf8"));
    const ctxAux = await browser.newContext(); const aux = await ctxAux.newPage();
    setConfig("area.atuacao", { ufs: ["ES"], municipios: ATENDO.map((nome) => ({ uf: "ES", nome })), atualizadoEm: new Date().toISOString() });
    for (const [vp, nomeVp] of [[PC, "pc"], [CEL, "cel"]]) {
      for (const tema of ["escuro", "claro"]) {
        if (process.env.SO && process.env.SO !== `${nomeVp}/${tema}`) continue;
        const { ctx, page, erros, zooms } = await abrir(browser, vp, tema);
        const rotulo = `[${nomeVp}/${tema}]`;
        await conferirMapa(page, aux, rotulo, { url: "/visitas" }, "visitas", zooms);
        await aproximar(page, `${rotulo} visitas`, "visitas", `${nomeVp}-${tema}`);
        zooms.clear();
        await conferirMapa(page, aux, rotulo, { url: "/dashboard" }, "dashboard", zooms);
        await aproximar(page, `${rotulo} dashboard`, "dashboard", `${nomeVp}-${tema}`);
        check(`${rotulo} nenhum erro de script na página`, erros.length === 0, erros.join(" | "));
        await ctx.close();
      }
    }
    if (!process.env.SO) {
      // Celular PEQUENO (320 px): o mapa do Dashboard tem ~254 px e a dica (220 px) quase não cabe ao lado do +/−. Aqui o mapa não
      // escreve nenhum nome (a dica é a única forma de ler a cidade), então só a dica é conferida: inteira no mapa, fora dos controles.
      const { ctx, page } = await abrir(browser, { width: 320, height: 640 }, "escuro");
      await page.mouse.move(2, 2);
      await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded" });
      await fecharLembrete(page);
      await page.waitForSelector(".leaflet-municipios-pane path", { timeout: 20000 });
      await page.locator(".leaflet-container").first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      await conferirDicasNasBordas(page, "[cel320/escuro] dashboard", true, "dashboard-cel320");
      await ctx.close();
    }
    if (!process.env.SO) {
      // Estado ruim: nenhuma cidade atendida → tudo cinza escuro com nome branco
      delConfig("area.atuacao");
      sql(`UPDATE "Municipio" SET "foraDeArea" = true;`);
      const { ctx, page } = await abrir(browser, PC, "escuro");
      await page.goto(BASE + "/visitas", { waitUntil: "domcontentloaded" });
      await fecharLembrete(page);
      await page.waitForSelector(".leaflet-municipios-pane path", { timeout: 20000 });
      await esperarRotulos(page);
      const mais = page.locator(".leaflet-control-zoom-in").first();
      await mais.click(); await page.waitForTimeout(900); await mais.click(); await page.waitForTimeout(1200);
      await esperarRotulos(page);
      const leg = page.locator('[data-mapa-legenda="vazia"]').first();
      check("[vazio] nenhuma cidade atendida: legenda diz e aponta para Configurações", (await leg.count()) === 1 && /Nenhuma cidade marcada/.test(await leg.innerText()) && (await leg.locator('a[href="/configuracoes"]').count()) === 1, await leg.innerText().catch(() => ""));
      const cinzas = await page.$$eval(".leaflet-municipios-pane path", (ps) => ps.filter((p) => (p.getAttribute("fill") || "").toLowerCase() === "#555c68").length);
      check("[vazio] o mapa fica todo cinza escuro", cinzas === 78, cinzas);
      const cores = await page.$$eval(".rotulo-municipio span", (ss) => [...new Set(ss.map((s) => getComputedStyle(s).color))]);
      check("[vazio] nome branco sobre o cinza escuro (e há nomes à vista)", cores.length === 1 && cores[0] === "rgb(255, 255, 255)", cores.join(",") || "nenhum nome");
      await page.locator(".leaflet-container").first().scrollIntoViewIfNeeded();
      await page.locator(".leaflet-container").first().locator("xpath=..").screenshot({ path: `${OUT}n-vazio-pc-escuro.png` });
      await ctx.close();
    }
  } catch (e) {
    falhou = true;
    console.error("\nO roteiro quebrou antes de terminar:", e && e.stack ? e.stack : e);
  } finally {
    // Devolve ao banco de teste o que havia antes — também quando o roteiro quebra.
    try { restaurarBanco(); } catch (e) { falhou = true; console.error("NÃO consegui restaurar o banco de teste:", e.message); }
    await browser.close().catch(() => {});
  }
  const ok = resultados.filter((r) => r.ok).length;
  console.log(`\n${ok}/${resultados.length} conferências passaram${falhou ? " (o roteiro quebrou no meio: veja o erro acima)" : ""}`);
  process.exit(!falhou && resultados.length > 0 && ok === resultados.length ? 0 : 1);
})();
