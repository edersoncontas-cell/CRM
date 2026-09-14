/**
 * Corrige o catálogo de máquinas próprias (New Holland/Dynapac) em produção
 * para bater com o portfólio oficial do vendedor (Fase 2B, item F):
 *
 *   (a) renomeia/mescla modelos próprios com nomenclatura antiga (ex: "E145C
 *       EVO", "RG140.B EVO") para o nome oficial curto (ex: "E145C", "RG140");
 *   (b) marca proprio:false (ou apaga, se sem vínculos) máquinas New Holland
 *       marcadas como próprias que NÃO estão no portfólio oficial (ex: CASE
 *       nunca deveria estar como proprio:true; E115C/E135B/W80C/W130C/B115C
 *       não são vendidas por este vendedor);
 *   (c) garante que os modelos oficiais faltantes existam (proprio:true, sem
 *       inventar specs numéricas).
 *
 * NUNCA mexe em concorrentes (proprio:false ou outras marcas).
 *
 * Uso:
 *   npx tsx scripts/corrigir-catalogo.ts           # dry-run (não altera nada)
 *   npx tsx scripts/corrigir-catalogo.ts --apply   # aplica de fato
 *
 * DATABASE_URL deve estar no .env da raiz ou exportado como variável de ambiente.
 */

import * as fs from "fs";
import * as path from "path";

function carregarEnv(envPath: string) {
  if (!fs.existsSync(envPath)) return;
  const linhas = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const linha of linhas) {
    const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"#\n]*)"?\s*(?:#.*)?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
carregarEnv(path.resolve(__dirname, "../.env"));

if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL não encontrado.");
  process.exit(1);
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

const aplicar = process.argv.includes("--apply");

// Nomes antigos/variantes → nome oficial curto (só aplicado em marca "New Holland").
const RENOMEAR: Record<string, string> = {
  "E145C EVO": "E145C",
  "E175C EVO": "E175C",
  "E215C EVO": "E215C",
  "E245C EVO": "E245C",
  "RG140.B EVO": "RG140",
  "RG170.B EVO": "RG170",
  "RG200.B EVO": "RG200",
  "RG140B": "RG140",
  "RG170B": "RG170",
  "RG200B": "RG200",
  "RG140.B": "RG140",
  "RG170.B": "RG170",
  "RG200.B": "RG200",
};

// Portfólio oficial New Holland (fonte: usuário) — categoria de cada modelo,
// usada só para criar os que estiverem faltando (sem inventar peso/potência).
const PORTFOLIO_NH: Record<string, string> = {
  E35D: "miniescavadeira",
  B95C: "retroescavadeira",
  B110C: "retroescavadeira",
  E145C: "escavadeira",
  E175C: "escavadeira",
  E215C: "escavadeira",
  E245C: "escavadeira",
  E385C: "escavadeira",
  E405C: "escavadeira",
  E485C: "escavadeira",
  E505C: "escavadeira",
  W130B: "pacarregadeira",
  W170B: "pacarregadeira",
  W190B: "pacarregadeira",
  RG140: "motoniveladora",
  RG170: "motoniveladora",
  RG200: "motoniveladora",
  L320: "minicarregadeira",
  L330: "minicarregadeira",
};

async function main() {
  console.log(aplicar ? "🚀 Aplicando correções no catálogo...\n" : "🔎 Dry-run — nada será alterado (rode com --apply para aplicar)\n");

  // (a) Renomear/mesclar nomenclatura antiga
  console.log("── (a) Renomear/mesclar nomenclatura ──");
  for (const [nomeAntigo, nomeNovo] of Object.entries(RENOMEAR)) {
    const antiga = await prisma.maquina.findFirst({ where: { marca: "New Holland", modelo: nomeAntigo } });
    if (!antiga) continue;
    const jaExisteNova = await prisma.maquina.findFirst({ where: { marca: "New Holland", modelo: nomeNovo } });

    if (jaExisteNova && jaExisteNova.id !== antiga.id) {
      console.log(`  MESCLAR: "${nomeAntigo}" (${antiga.id}) → "${nomeNovo}" (${jaExisteNova.id}) já existe; migra vínculos e apaga a antiga.`);
      if (aplicar) {
        await prisma.$transaction([
          prisma.notaMaquina.updateMany({ where: { maquinaId: antiga.id }, data: { maquinaId: jaExisteNova.id } }),
          prisma.maquina.delete({ where: { id: antiga.id } }),
        ]);
      }
    } else {
      console.log(`  RENOMEAR: "${nomeAntigo}" → "${nomeNovo}"`);
      if (aplicar) {
        await prisma.maquina.update({ where: { id: antiga.id }, data: { modelo: nomeNovo } });
      }
    }
  }

  // (b) Máquinas New Holland proprio:true fora do portfólio oficial
  console.log("\n── (b) New Holland proprio:true fora do portfólio oficial ──");
  const oficiais = new Set(Object.keys(PORTFOLIO_NH));
  const nhProprias = await prisma.maquina.findMany({
    where: { marca: "New Holland", proprio: true },
    include: { _count: { select: { notas: true } } },
  });
  for (const m of nhProprias) {
    if (oficiais.has(m.modelo)) continue;
    const temVinculos = m._count.notas > 0;
    if (temVinculos) {
      console.log(`  DESMARCAR proprio: "${m.modelo}" (tem ${m._count.notas} nota(s) vinculada(s))`);
      if (aplicar) await prisma.maquina.update({ where: { id: m.id }, data: { proprio: false } });
    } else {
      console.log(`  APAGAR: "${m.modelo}" (fora do portfólio, sem vínculos)`);
      if (aplicar) await prisma.maquina.delete({ where: { id: m.id } });
    }
  }

  // (c) Garantir modelos oficiais faltantes
  console.log("\n── (c) Modelos oficiais faltantes ──");
  for (const [modelo, categoria] of Object.entries(PORTFOLIO_NH)) {
    const existe = await prisma.maquina.findFirst({ where: { marca: "New Holland", modelo } });
    if (existe) {
      if (!existe.proprio) {
        console.log(`  MARCAR proprio: "${modelo}" já existe mas estava proprio:false`);
        if (aplicar) await prisma.maquina.update({ where: { id: existe.id }, data: { proprio: true } });
      }
      continue;
    }
    console.log(`  CRIAR: "${modelo}" (${categoria})`);
    if (aplicar) {
      await prisma.maquina.create({ data: { marca: "New Holland", modelo, categoria, proprio: true } });
    }
  }

  console.log(aplicar ? "\n✅ Concluído." : "\nℹ️  Dry-run — nada foi alterado. Rode com --apply para aplicar de verdade.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
