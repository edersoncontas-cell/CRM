// Componente de navegador ("use client") não pode importar VALOR de arquivo
// que abre o banco: o Prisma vai junto para o navegador e a tela cai inteira
// em "Algo deu errado nesta página" (PrismaClient is unable to run in this
// browser environment). Foi o que derrubou a tela Demandas — um rótulo
// importado de lib/demandas.ts. Tipo (import type) pode; ação ("use server")
// pode, porque vira chamada ao servidor.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "..");
const IMPORTACAO = /^import\s+(?!type\b)([^;]*?)\s+from\s+["']([^"']+)["']/gm;

function todos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? todos(p) : /\.(tsx?)$/.test(e.name) ? [p] : [];
  });
}

function resolver(spec: string, de: string): string | null {
  const base = spec.startsWith("@/") ? path.join(RAIZ, "src", spec.slice(2)) : spec.startsWith(".") ? path.resolve(path.dirname(de), spec) : null;
  if (!base) return null;
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx", ""]) {
    if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return base + ext;
  }
  return null;
}

/** Só tipos entre as chaves: `import { type A, type B } from`. */
const soTipos = (o: string) => /^\{\s*(type\s+\w+\s*,?\s*)+\}$/.test(o.trim());

const memo = new Map<string, string | null>();
/** O caminho de importações até o banco, ou null se o arquivo não chega nele. */
function chegaNoBanco(arquivo: string, visto = new Set<string>()): string | null {
  if (memo.has(arquivo)) return memo.get(arquivo)!;
  if (visto.has(arquivo)) return null;
  visto.add(arquivo);
  const src = fs.readFileSync(arquivo, "utf8");
  let achou: string | null = null;
  if (!/^\s*["']use server["']/.test(src)) {
    for (const m of src.matchAll(IMPORTACAO)) {
      const [, oque, spec] = m;
      if (soTipos(oque)) continue;
      if (spec === "@/lib/db" || spec === "@prisma/client" || /(^|\/)db$/.test(spec)) { achou = spec; break; }
      const r = resolver(spec, arquivo);
      const via = r ? chegaNoBanco(r, visto) : null;
      if (via) { achou = `${spec} → ${via}`; break; }
    }
  }
  memo.set(arquivo, achou);
  return achou;
}

describe("componente de navegador não leva o banco junto", () => {
  it("nenhum 'use client' importa valor de arquivo que abre o banco", () => {
    const problemas: string[] = [];
    for (const f of todos(path.join(RAIZ, "src"))) {
      const src = fs.readFileSync(f, "utf8");
      if (!/^\s*["']use client["']/.test(src)) continue;
      for (const m of src.matchAll(IMPORTACAO)) {
        const [, oque, spec] = m;
        if (soTipos(oque)) continue;
        const r = resolver(spec, f);
        const via = r ? chegaNoBanco(r) : null;
        if (via) problemas.push(`${path.relative(RAIZ, f)}: ${oque.trim()} de ${spec} (${via})`);
      }
    }
    expect(problemas).toEqual([]);
  });
});
