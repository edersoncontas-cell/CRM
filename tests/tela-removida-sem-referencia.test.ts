// "Remova esse card" (01/10): sete cards saíram de Configurações (cinco
// removidos, dois mudaram para a Central Inteligente). Texto que
// manda o vendedor para uma tela que não existe mais é o jeito de ele ficar
// perdido sem ninguém ver — este teste lê o código-fonte atrás desses textos.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const fontes = arquivos(join(__dirname, "..", "src")).map((p) => ({ p, s: readFileSync(p, "utf8") }));

describe("textos que apontam para telas removidas", () => {
  for (const frase of [
    "Configurações → Envio de mensagens",
    "Libere em Configurações",
    "Configurações → Conversas antigas",
    "Configurações → Filtro de contatos",
    "Configurações → Tema",
    "Configurações › Realidade do negócio",
    "Configurações → Realidade do negócio",
    "Configurações → Travas",
    "Configurações → Exportar",
    "Configurações → Mensagens com erro",
    "Configurações → \"Atualizar aprendizado agora\"",
  ]) {
    it(`ninguém manda o vendedor para "${frase}"`, () => {
      const onde = fontes.filter((f) => f.s.includes(frase)).map((f) => f.p);
      expect(onde).toEqual([]);
    });
  }
});
