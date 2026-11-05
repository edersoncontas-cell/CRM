import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { TODOS_HREFS } from "../src/lib/menu";

// 05/11: o ZEUS saiu do menu e virou a aba "ZEUS" da Central Inteligente.
// O que este teste segura: o endereço antigo não pode virar tela morta, e
// nenhuma ação pode continuar renovando só /zeus (a aba nova ficaria velha).
const ler = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("ZEUS dentro da Central Inteligente", () => {
  it("o menu não tem mais /zeus, e a Central continua lá", () => {
    expect(TODOS_HREFS).not.toContain("/zeus");
    expect(TODOS_HREFS).toContain("/cerebro");
  });

  it("/zeus redireciona para a aba ZEUS", () => {
    expect(ler("src/app/(app)/zeus/page.tsx")).toMatch(/redirect\("\/cerebro\?aba=zeus"\)/);
  });

  it("a Central mostra a aba ZEUS com o painel e as chaves de IA", () => {
    const pagina = ler("src/app/(app)/cerebro/page.tsx");
    expect(pagina).toMatch(/aba === "zeus"/);
    expect(pagina).toMatch(/<ZeusAba \/>/);
    const aba = ler("src/app/(app)/cerebro/zeus-aba.tsx");
    expect(aba).toMatch(/<ChavesIACard/);
    expect(aba).toMatch(/<ZeusPainel/);
  });

  it("nenhuma ação renova só /zeus", () => {
    const culpados = arquivos(join(__dirname, "..", "src")).filter((f) => /revalidatePath\(\s*["'`]\/zeus["'`]/.test(readFileSync(f, "utf8")));
    expect(culpados).toEqual([]);
  });
});
