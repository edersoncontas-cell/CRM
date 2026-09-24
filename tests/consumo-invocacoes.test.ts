// Consumo de invocações: nenhuma tela chama o servidor em segundo plano.
//
// Quatro componentes tinham setInterval de 60 s que continuava rodando com a
// aba escondida. Cada volta chamava uma rota que consulta o banco — o Neon
// nunca suspendia, e a cota grátis de computação estourou (CRM fora do ar em
// 23/09/2026). Ver docs/consumo-invocacoes.md.
//
// Este teste lê o CÓDIGO: todo setInterval que chama o servidor tem que checar
// a visibilidade dentro da própria volta, e usar o intervalo combinado.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { INTERVALO_MERCADO, INTERVALO_ALERTAS, INTERVALO_MAPA_VENDAS } from "@/lib/intervalos-atualizacao";

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("intervalos combinados", () => {
  it("mercado 15 min, alertas 10 min, mapa 10 min", () => {
    expect(INTERVALO_MERCADO).toBe(15 * 60_000);
    expect(INTERVALO_ALERTAS).toBe(10 * 60_000);
    expect(INTERVALO_MAPA_VENDAS).toBe(10 * 60_000);
  });
});

describe("cada componente", () => {
  const casos: [string, string][] = [
    ["src/components/Sidebar.tsx", "INTERVALO_ALERTAS"],
    ["src/components/RodapeMercado.tsx", "INTERVALO_MERCADO"],
    ["src/components/TickerMercado.tsx", "INTERVALO_MERCADO"],
    ["src/components/MapaVendasES.tsx", "INTERVALO_MAPA_VENDAS"],
  ];
  for (const [arquivo, constante] of casos) {
    it(`${arquivo}: usa ${constante} e só chama com a tela visível`, () => {
      const s = ler(arquivo);
      const re = new RegExp(`setInterval\\(\\(\\) => \\{ if \\(document\\.visibilityState === "visible"\\) \\w+\\(\\); \\}, ${constante}\\)`);
      expect(s).toMatch(re);
      expect(s).not.toMatch(/setInterval\([^)]*,\s*60_000\)/);
    });
  }

  it("Conexão do WhatsApp (a cada 5 s, lê o banco): também só com a tela visível", () => {
    expect(ler("src/components/ConexaoWhatsApp.tsx")).toMatch(/setInterval\(\(\) => \{ if \(document\.visibilityState === "visible"\) loop\(\); \}, 5000\)/);
  });
});

// A rede de segurança: qualquer setInterval NOVO numa tela que faça fetch,
// router.refresh ou chame ação do servidor precisa checar a visibilidade.
describe("nenhum setInterval novo chamando o servidor em segundo plano", () => {
  it("todo setInterval de componente que busca dados checa a visibilidade", () => {
    const pasta = join(process.cwd(), "src/components");
    const culpados: string[] = [];
    for (const nome of readdirSync(pasta)) {
      if (!/\.tsx?$/.test(nome)) continue;
      const s = readFileSync(join(pasta, nome), "utf8");
      const faz_rede = /fetch\(|router\.refresh\(|Action\(/.test(s);
      if (!faz_rede) continue;
      // cada setInterval: olha o corpo até o fechamento da chamada
      for (const m of s.matchAll(/setInterval\(([\s\S]{0,400}?)\)\s*;/g)) {
        const corpo = m[1];
        const soLocal = /^\s*\(\)\s*=>\s*set[A-Z]\w*\(/.test(corpo); // só mexe em estado local (relógio, contador)
        if (soLocal) continue;
        if (!/visibilityState/.test(corpo)) culpados.push(`${nome}: setInterval(${corpo.trim().slice(0, 60)}…)`);
      }
    }
    expect(culpados).toEqual([]);
  });
});
