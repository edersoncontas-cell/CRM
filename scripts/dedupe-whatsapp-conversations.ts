/**
 * Deduplica WhatsAppConversation por externalPhone (necessário ANTES de aplicar
 * a constraint @@unique([externalPhone]) do schema, senão a migração falha se
 * já existirem duplicatas em produção).
 *
 * Para cada grupo de conversas com o mesmo externalPhone: escolhe a conversa
 * "principal" (tem clienteId vinculado > mais mensagens > mais antiga) e migra
 * as mensagens das demais para ela, preservando contactName/foto/lid quando a
 * principal não tiver, depois apaga as duplicatas.
 *
 * Uso:
 *   npx tsx scripts/dedupe-whatsapp-conversations.ts           # dry-run (não altera nada)
 *   npx tsx scripts/dedupe-whatsapp-conversations.ts --apply   # aplica de fato
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

async function main() {
  const grupos = await prisma.whatsAppConversation.groupBy({
    by: ["externalPhone"],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  if (!grupos.length) {
    console.log("✅ Nenhuma conversa duplicada encontrada.");
    return;
  }

  console.log(`⚠️  ${grupos.length} telefone(s) com conversas duplicadas.`);
  let totalMsgsMigradas = 0;
  let totalConvsRemovidas = 0;

  for (const g of grupos) {
    const convs = await prisma.whatsAppConversation.findMany({
      where: { externalPhone: g.externalPhone },
      include: { _count: { select: { messages: true } } },
      orderBy: { createdAt: "asc" },
    });

    // Principal: tem clienteId > mais mensagens > mais antiga (já é a 1ª por orderBy).
    const principal = [...convs].sort((a, b) => {
      if (!!a.clienteId !== !!b.clienteId) return a.clienteId ? -1 : 1;
      if (a._count.messages !== b._count.messages) return b._count.messages - a._count.messages;
      return 0;
    })[0];

    const duplicatas = convs.filter((c) => c.id !== principal.id);

    console.log(
      `\n📱 ${g.externalPhone}: principal=${principal.id} (${principal._count.messages} msgs)` +
      ` — duplicatas: ${duplicatas.map((d) => `${d.id} (${d._count.messages} msgs)`).join(", ")}`
    );

    if (!aplicar) continue;

    await prisma.$transaction(async (tx) => {
      const patch: Record<string, unknown> = {};
      for (const dup of duplicatas) {
        if (!principal.contactName && dup.contactName) patch.contactName = dup.contactName;
        if (!principal.contactPhotoUrl && dup.contactPhotoUrl) patch.contactPhotoUrl = dup.contactPhotoUrl;
        if (!principal.lid && dup.lid) patch.lid = dup.lid;
      }
      const maisRecente = convs.reduce((a, b) => (b.lastMessageAt > a.lastMessageAt ? b : a));
      patch.lastMessageAt = maisRecente.lastMessageAt;

      for (const dup of duplicatas) {
        await tx.whatsAppMessage.updateMany({ where: { conversationId: dup.id }, data: { conversationId: principal.id } });
      }
      if (Object.keys(patch).length) {
        await tx.whatsAppConversation.update({ where: { id: principal.id }, data: patch });
      }
      await tx.whatsAppConversation.deleteMany({ where: { id: { in: duplicatas.map((d) => d.id) } } });
    });

    totalMsgsMigradas += duplicatas.reduce((s, d) => s + d._count.messages, 0);
    totalConvsRemovidas += duplicatas.length;
  }

  if (aplicar) {
    console.log(`\n✅ Concluído: ${totalConvsRemovidas} conversa(s) duplicada(s) removida(s), ${totalMsgsMigradas} mensagem(ns) migrada(s).`);
  } else {
    console.log("\nℹ️  Dry-run — nada foi alterado. Rode com --apply para aplicar de verdade.");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
