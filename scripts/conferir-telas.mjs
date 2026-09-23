// CONFERIR TODAS AS TELAS — no PC (1440) e no celular (390), em PRODUÇÃO.
//
// A regra 7 do CLAUDE.md pede isto a cada alteração. O que ele confere em cada
// tela: o código HTTP (200), se caiu no "Algo deu errado", se estourou erro no
// navegador e se foi parar em outro endereço.
//
// Conferir em produção (next start) e não em dev é de propósito: foi um build
// de produção que mostrou o funil caído com o Prisma indo parar no navegador —
// em dev, com outro empacotamento, o defeito não aparecia igual.
//
// Como rodar:
//   npm run build
//   NODE_ENV=production AUTH_SECRET=segredo-local APP_PASSWORD=teste-local-123 \
//     DATABASE_URL=... npx next start -p 3000 &
//   TOKEN=$(node -e 'console.log(require("crypto").createHash("sha256").update("teste-local-123::segredo-local").digest("hex"))') \
//     SP=/tmp/telas node scripts/conferir-telas.mjs
//
// O TOKEN é o cookie de sessão calculado à mão (sha256 de "senha::segredo"),
// para não depender de preencher formulário de login no robô.

import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
const ROTAS = ["/dashboard","/alertas","/orientador","/negociacoes","/pipeline","/atendimento",
  "/visitas","/clientes","/marketing","/maquinas/fichas","/comparativo","/usadas","/calculadora",
  "/como-voce-vende","/academia","/financeiro","/financeiro/faturadas","/vendas-perdidas",
  "/pos-venda","/auditoria","/configuracoes","/conexao","/zeus","/cerebro"];
const SP = process.env.SP;
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
let ruins = 0;
for (const [medida, w, h] of [["pc", 1440, 900], ["celular", 390, 844]]) {
  const ctx = await nav.newContext({ viewport: { width: w, height: h } });
  const pg = await ctx.newPage();
  await ctx.addCookies([{ name: "crm_auth", value: process.env.TOKEN, domain: "localhost", path: "/" }]);
  await pg.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
  await pg.waitForTimeout(1500);
  console.log(`[${medida}] entrou: ${pg.url()}`);
  for (const r of ROTAS) {
    const erros = [];
    const ouvinte = (e) => erros.push(String(e).replace(/\s+/g, " ").slice(0, 110));
    pg.on("pageerror", ouvinte);
    const resp = await pg.goto("http://localhost:3000" + r, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => { erros.push("GOTO " + String(e).slice(0, 60)); return null; });
    await pg.waitForTimeout(900);
    pg.off("pageerror", ouvinte);
    const status = resp ? resp.status() : 0;
    const txt = ((await pg.textContent("body").catch(() => "")) ?? "").replace(/\s+/g, " ");
    const quebrou = /Algo deu errado nesta p/i.test(txt) || /Internal Server Error/i.test(txt);
    const foraDoLugar = !pg.url().includes(r);
    if (quebrou || erros.length || status !== 200 || foraDoLugar) {
      ruins++;
      console.log(`[${medida}] ${r} — http=${status}${quebrou ? " QUEBROU" : ""}${foraDoLugar ? " (foi parar em " + pg.url() + ")" : ""} · ${erros.slice(0, 2).join(" | ")}`);
    }
  }
  for (const [nome, rota] of [["dashboard", "/dashboard"], ["clientes", "/clientes"], ["pipeline", "/pipeline"], ["atendimento", "/atendimento"]]) {
    await pg.goto("http://localhost:3000" + rota, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
    await pg.waitForTimeout(1200);
    await pg.screenshot({ path: `${SP}/prod-${medida}-${nome}.png` });
  }
  await ctx.close();
  console.log(`[${medida}] varreu ${ROTAS.length} telas`);
}
console.log(ruins === 0 ? "TODAS AS TELAS LIMPAS (produção)" : `${ruins} tela(s) com problema`);
await nav.close();
