// DIAGNÓSTICO — para quando a tela só diz "Algo deu errado".
//
// A tela de erro esconde a mensagem de propósito (build de produção não mostra
// detalhe para não vazar dado). O resultado é que, com o CRM fora do ar, sobra
// adivinhar — e adivinhar já custou um dia inteiro.
//
// Esta rota testa CADA peça separada e mostra o erro POR EXTENSO. Cada teste é
// isolado: um que falha não impede os outros de rodarem, então dá para ver
// exatamente onde a corrente arrebenta.
//
// Continua atrás do login (o middleware cobre /api/*). E nunca mostra valor de
// credencial: só diz se a variável existe.

import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Numa linha só e cortado: isto vai ser lido no celular, na rua.
function recado(e: unknown): string {
  const um = (t: string) => t.replace(/\s+/g, " ").trim();
  if (e instanceof Error) {
    const causa = (e as { cause?: unknown }).cause;
    return um(`${e.name}: ${e.message}`).slice(0, 320) + (causa ? ` | causa: ${um(String(causa)).slice(0, 120)}` : "");
  }
  return um(String(e)).slice(0, 320);
}

async function testar(nome: string, fn: () => Promise<string>): Promise<string> {
  const t0 = Date.now();
  try {
    const r = await fn();
    return `[ok]    ${nome} (${Date.now() - t0}ms) — ${r}`;
  } catch (e) {
    return `[FALHOU] ${nome} (${Date.now() - t0}ms)\n         ${recado(e)}`;
  }
}

export async function GET() {
  const linhas: string[] = [];
  linhas.push("DIAGNÓSTICO DO CRM — " + new Date().toISOString());
  linhas.push("");

  // 1. Configuração. Só a presença, NUNCA o valor: é credencial.
  const vars = ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "APP_PASSWORD", "AUTH_SECRET", "CRON_SECRET"];
  linhas.push("— Variáveis de ambiente (só se existem, nunca o valor)");
  for (const v of vars) linhas.push(`   ${process.env[v] ? "tem" : "NÃO TEM"}  ${v}`);
  linhas.push(`   deploy: ${(process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 12)}`);
  linhas.push("");

  // 2. O banco, do mais simples ao mais parecido com o que a tela faz.
  linhas.push("— Banco de dados");
  linhas.push(await testar("conectar e responder (SELECT 1)", async () => {
    await db.$queryRawUnsafe("SELECT 1");
    return "respondeu";
  }));
  linhas.push(await testar("tamanho do banco", async () => {
    const r = await db.$queryRawUnsafe<{ t: string }[]>(
      "SELECT pg_size_pretty(pg_database_size(current_database())) AS t");
    return `${r[0]?.t ?? "?"} — o limite do plano grátis do Neon é 0,5 GB; estourando, o banco vira só-leitura`;
  }));
  linhas.push(await testar("LER: contar clientes", async () => `${await db.cliente.count()} cliente(s)`));
  linhas.push(await testar("LER: contar negociações", async () => `${await db.negociacao.count()} negociação(ões)`));
  linhas.push(await testar("LER: contar mensagens de WhatsApp", async () => `${await db.whatsAppMessage.count()} mensagem(ns)`));
  linhas.push(await testar("ESCREVER (é aqui que aparece banco só-leitura / cota estourada)", async () => {
    await db.configuracao.upsert({
      where: { chave: "diag.ping" },
      update: { valor: new Date().toISOString() },
      create: { chave: "diag.ping", valor: new Date().toISOString() },
    });
    return "gravou";
  }));
  linhas.push("");

  // 3. O que a migração de hoje deixou no banco. O código no ar não usa nada
  //    disso — é só para saber em que pé o banco ficou.
  linhas.push("— Restos da migração de multiusuário (o código no ar ignora)");
  linhas.push(await testar("colunas vendedorId", async () => {
    const r = await db.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema = current_schema() AND column_name = 'vendedorId'`);
    return `${r[0]?.n ?? 0} de 8`;
  }));
  linhas.push(await testar("tabela Usuario", async () => {
    const r = await db.$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_name = 'Usuario'`);
    return r[0]?.n ? "existe" : "não existe";
  }));
  linhas.push(await testar("marcas de manutenção gravadas", async () => {
    const r = await db.configuracao.findMany({ where: { chave: { startsWith: "manutencao." } }, select: { chave: true, valor: true } });
    return r.length ? r.map((c) => `${c.chave}=${c.valor}`).join(", ") : "nenhuma";
  }));
  linhas.push("");

  // 4. O que o Dashboard chama ALÉM do banco. Se o banco está de pé e a tela
  //    cai mesmo assim, é aqui. Estes dois saem para fora da Vercel.
  linhas.push("— Serviços de fora que o Dashboard usa");
  linhas.push(await testar("cotações (café/dólar)", async () => {
    const { obterCotacoes } = await import("@/lib/mercado");
    const c = await obterCotacoes();
    return `fonte ${c.fonte ?? "?"}`;
  }));
  linhas.push(await testar("notícias do setor", async () => {
    const { obterNoticias } = await import("@/lib/noticias");
    const n = await obterNoticias();
    return `${n.itens.length} notícia(s)`;
  }));
  linhas.push("");
  linhas.push("Manda esta tela inteira para o Claude.");

  return new Response(linhas.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
