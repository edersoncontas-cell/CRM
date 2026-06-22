/**
 * Importa 23 lotes de contatos WhatsApp direto no banco de produção.
 *
 * Uso:
 *   npx tsx scripts/importar-lotes.ts [/caminho/para/os/arquivos]
 *
 * DATABASE_URL deve estar no .env da raiz ou exportado como variável de ambiente.
 * Por padrão os arquivos são procurados em /root/.claude/uploads/<dir-com-lote>/
 * ou no diretório passado como argumento.
 */

import * as fs from "fs";
import * as path from "path";

// ── Carrega .env manualmente (sem dependência de dotenv) ────────────────────
function carregarEnv(envPath: string) {
  if (!fs.existsSync(envPath)) return;
  const linhas = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const linha of linhas) {
    const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"#\n]*)"?\s*(?:#.*)?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
carregarEnv(path.resolve(__dirname, "../.env"));

// Valida DATABASE_URL antes de importar Prisma
if (!process.env.DATABASE_URL) {
  console.error("❌  DATABASE_URL não encontrado.");
  console.error("   Crie o arquivo .env na raiz com DATABASE_URL= ou exporte a variável.");
  process.exit(1);
}

// Importa depois do env estar carregado
import { PrismaClient } from "@prisma/client";
import { phoneLookupVariants } from "../src/lib/whatsapp-routing";
import { importarMensagens } from "../src/lib/whatsapp-store";
import { deveDescartarContato } from "../src/lib/utils";

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

// ── Tipos ────────────────────────────────────────────────────────────────────

type MsgHistorico = {
  iso?: string;
  data?: string;
  de_mim: boolean;
  remetente: string | null;
  tipo?: string;
  mensagem?: string;
};

type ClienteJSON = {
  nome: string;
  telefone?: string;
  tipo?: string;
  primeiro_contato?: string;
  ultimo_contato?: string;
  historico?: MsgHistorico[];
};

type LoteJSON = {
  lote: number;
  total_lotes: number;
  clientes_neste_lote: number;
  clientes: ClienteJSON[];
};

// ── Helpers (mesma lógica do route.ts) ───────────────────────────────────────

function normPhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits || digits.length < 8) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function parseDataBR(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00.000-03:00`);
}

function mapMsg(m: MsgHistorico): { fromMe: boolean; sender: string | null; body: string; sentAt: string } {
  const sentAt =
    m.iso ??
    (m.data ? parseDataBR(m.data)?.toISOString() ?? new Date().toISOString() : new Date().toISOString());
  const body =
    m.mensagem?.trim() ||
    (m.tipo === "ptt" || m.tipo === "audio"
      ? "🎵 Áudio"
      : m.tipo === "image"
      ? "📷 Imagem"
      : m.tipo === "document"
      ? "📄 Documento"
      : m.tipo === "video"
      ? "🎬 Vídeo"
      : m.tipo === "sticker"
      ? "Figurinha"
      : "");
  return { fromMe: !!m.de_mim, sender: m.remetente || null, body, sentAt };
}

// ── Processamento de um único cliente ────────────────────────────────────────

async function processarCliente(
  c: ClienteJSON,
  totais: { criados: number; atualizados: number; mensagens: number; ignorados: number; erros: number }
): Promise<void> {
  const nome = c.nome?.trim();
  if (!nome) { totais.ignorados++; return; }

  const isGroup = c.tipo === "grupo";
  const phone = normPhone(c.telefone ?? "");

  try {
    let conv = null as Awaited<ReturnType<typeof prisma.whatsAppConversation.findFirst>>;

    if (!isGroup && phone) {
      const variants = phoneLookupVariants(phone);
      conv = await prisma.whatsAppConversation.findFirst({
        where: { externalPhone: { in: variants } },
        orderBy: { lastMessageAt: "desc" },
      });
    } else if (isGroup) {
      conv = await prisma.whatsAppConversation.findFirst({
        where: { isGroup: true, groupName: { equals: nome, mode: "insensitive" } },
        orderBy: { lastMessageAt: "desc" },
      });
    }

    const lastAt = parseDataBR(c.ultimo_contato ?? "") ?? new Date(0);

    if (!conv) {
      const extPhone = phone ?? `imp:${nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;

      let clienteId: string | null = null;
      if (!isGroup && phone && !deveDescartarContato(nome)) {
        const variants = phoneLookupVariants(phone);
        const cli = await prisma.cliente.findFirst({ where: { telefone: { in: variants } } });
        if (cli) {
          clienteId = cli.id;
        } else {
          const novo = await prisma.cliente.create({
            data: { nome, telefone: phone, origem: "whatsapp_historico" },
          });
          clienteId = novo.id;
        }
      }

      conv = await prisma.whatsAppConversation.create({
        data: {
          externalPhone: extPhone,
          isGroup,
          contactName: isGroup ? null : nome,
          groupName: isGroup ? nome : null,
          lastMessageAt: lastAt > new Date(0) ? lastAt : new Date(),
          clienteId,
        },
      });
      totais.criados++;
    } else {
      const patch: Record<string, unknown> = {};
      if (!conv.contactName && !isGroup) patch.contactName = nome;
      if (!conv.groupName && isGroup) patch.groupName = nome;
      if (lastAt > conv.lastMessageAt) patch.lastMessageAt = lastAt;

      if (!conv.clienteId && !isGroup && phone && !deveDescartarContato(nome)) {
        const variants = phoneLookupVariants(phone);
        const cli = await prisma.cliente.findFirst({ where: { telefone: { in: variants } } });
        if (cli) patch.clienteId = cli.id;
      }

      if (Object.keys(patch).length) {
        await prisma.whatsAppConversation.update({ where: { id: conv.id }, data: patch });
      }
      totais.atualizados++;
    }

    if (Array.isArray(c.historico) && c.historico.length) {
      const msgs = c.historico.map(mapMsg).filter((m) => m.body || m.sentAt);
      const n = await importarMensagens(conv.id, msgs, isGroup);
      totais.mensagens += n;
    }
  } catch (e) {
    console.error(`  ✗ Erro em "${nome}":`, e instanceof Error ? e.message : e);
    totais.erros++;
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Determina o diretório dos arquivos
  let dir = process.argv[2];

  if (!dir) {
    const uploadsBase = "/root/.claude/uploads";
    if (fs.existsSync(uploadsBase)) {
      const subdirs = fs
        .readdirSync(uploadsBase)
        .map((d) => path.join(uploadsBase, d))
        .filter((d) => fs.statSync(d).isDirectory());
      const found = subdirs.find((d) => fs.readdirSync(d).some((f) => f.includes("lote")));
      if (found) dir = found;
    }
  }

  if (!dir || !fs.existsSync(dir)) {
    console.error("❌  Diretório de arquivos não encontrado.");
    console.error("   Passe o caminho como argumento: npx tsx scripts/importar-lotes.ts /caminho/para/arquivos");
    process.exit(1);
  }

  const arquivos = fs
    .readdirSync(dir)
    .filter((f) => f.includes("lote") && f.endsWith(".json"))
    .sort((a, b) => {
      const na = parseInt(a.match(/lote_?0*(\d+)/)?.[1] ?? "0");
      const nb = parseInt(b.match(/lote_?0*(\d+)/)?.[1] ?? "0");
      return na - nb;
    });

  if (!arquivos.length) {
    console.error(`❌  Nenhum arquivo *lote*.json encontrado em: ${dir}`);
    process.exit(1);
  }

  console.log(`\n🚀 Importando ${arquivos.length} lotes de: ${dir}\n`);

  const totais = { criados: 0, atualizados: 0, mensagens: 0, ignorados: 0, erros: 0 };
  let totalContatos = 0;

  for (const arquivo of arquivos) {
    const filePath = path.join(dir, arquivo);
    let lote: LoteJSON;
    try {
      lote = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) {
      console.error(`  ✗ Erro ao ler ${arquivo}:`, e);
      totais.erros++;
      continue;
    }

    const clientes: ClienteJSON[] = Array.isArray(lote.clientes) ? lote.clientes : [];
    totalContatos += clientes.length;

    process.stdout.write(`  Lote ${String(lote.lote ?? "?").padStart(2, "0")}/${lote.total_lotes ?? "?"} — ${clientes.length} contatos... `);
    const snap = { c: totais.criados, a: totais.atualizados };

    for (const c of clientes) await processarCliente(c, totais);

    console.log(`✓  (+${totais.criados - snap.c} criados, ~${totais.atualizados - snap.a} atualizados)`);
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RESUMO FINAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total de contatos processados : ${totalContatos}
  Conversas criadas             : ${totais.criados}
  Conversas atualizadas         : ${totais.atualizados}
  Mensagens importadas          : ${totais.mensagens}
  Ignorados (sem nome)          : ${totais.ignorados}
  Erros                         : ${totais.erros}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Erro fatal:", e);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});
