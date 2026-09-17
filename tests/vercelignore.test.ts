import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Guarda contra a regressão de 16/09: "evolution" sem barra no .vercelignore
// excluía src/app/api/webhooks/evolution/ do deploy e o webhook do WhatsApp
// sumia da Vercel (404), sem erro nenhum no build. Padrão sem âncora vale
// para qualquer pasta com aquele nome, em qualquer profundidade.
describe(".vercelignore", () => {
  const linhas = readFileSync(join(process.cwd(), ".vercelignore"), "utf8")
    .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));

  it("tem padrões e todos são ancorados na raiz (começam com /)", () => {
    expect(linhas.length).toBeGreaterThan(0);
    for (const l of linhas) expect(l, `padrão "${l}" precisa começar com / — sem isso ele apaga pastas dentro de src/`).toMatch(/^\//);
  });

  it("não ignora nada de src/", () => {
    for (const l of linhas) expect(l.startsWith("/src")).toBe(false);
  });
});
