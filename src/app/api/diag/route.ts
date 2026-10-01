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
import { colunasDoSchema, oQueFalta, SQL_COLUNAS_DO_BANCO, type ColunaNoBanco } from "@/lib/coluna-que-falta";

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
  const vars = ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "DATABASE_URL_PROVISORIO", "APP_PASSWORD", "AUTH_SECRET", "CRON_SECRET"];
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
  // O banco tem tudo o que o código de agora pede? Banco que voltou de dias
  // parado (o Neon, depois de 23/09) pode estar sem coluna de uma migração que
  // não chegou a rodar. Só lê: quem cria é a manutenção — ou o conserto na
  // hora, quando uma consulta pede a coluna (lib/coluna-que-falta.ts).
  linhas.push(await testar("estrutura: o que o código pede e o banco não tem", async () => {
    const noBanco = await db.$queryRawUnsafe<ColunaNoBanco[]>(SQL_COLUNAS_DO_BANCO);
    const schema = colunasDoSchema();
    const tabelas = new Set(noBanco.map((r) => r.tabela));
    const semTabela = [...schema.keys()].filter((t) => !tabelas.has(t));
    const { comandos, semComoCriar } = oQueFalta(noBanco, schema);
    const criaveis = comandos.flatMap((c) => c.colunas.map((col) => `${c.tabela}.${col}`));
    if (semTabela.length || semComoCriar.length) {
      throw new Error([
        semTabela.length ? `tabela(s) que faltam: ${semTabela.join(", ")}` : "",
        semComoCriar.length ? `coluna(s) que faltam e só a migração cria: ${semComoCriar.join(", ")}` : "",
        criaveis.length ? `e ${criaveis.length} coluna(s) que o CRM cria sozinho na 1ª consulta que pedir: ${criaveis.join(", ")}` : "",
      ].filter(Boolean).join(" · ") + " — veja o card Manutenção em Configurações");
    }
    if (criaveis.length) return `faltam ${criaveis.length} coluna(s), criadas sozinhas na 1ª consulta que pedir: ${criaveis.join(", ")}`;
    return `nada — ${schema.size} tabelas, todas as colunas`;
  }));
  // 2b. O OUTRO endereço do Neon.
  //
  // O Neon dá dois: o com "-pooler" (que o CRM usa) e o direto. Eles são
  // servidos por caminhos diferentes — um pode cair e o outro continuar de pé.
  // Se o direto responder, o CRM volta trocando UMA variável na Vercel, sem
  // esperar cota nem pagar plano. Se os dois caírem, o problema é o projeto
  // inteiro, e isso também é resposta.
  linhas.push("");
  linhas.push("— O outro endereço do Neon (o direto, sem pooler)");
  if (!process.env.DATABASE_URL_UNPOOLED) {
    linhas.push("   NÃO TEM DATABASE_URL_UNPOOLED configurada — sem ela não dá para testar o endereço direto.");
  } else {
    linhas.push(await testar("conectar pelo endereço DIRETO", async () => {
      const { PrismaClient } = await import("@prisma/client");
      const solto = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_UNPOOLED } } });
      try {
        await solto.$queryRawUnsafe("SELECT 1");
        return "RESPONDEU — o banco está vivo; quem está fora é só o endereço com pooler. " +
               "Conserto: trocar DATABASE_URL pelo valor de DATABASE_URL_UNPOOLED na Vercel e republicar.";
      } finally {
        await solto.$disconnect().catch(() => {});
      }
    }));
  }
  linhas.push("");

  // 2c. O banco PROVISÓRIO (quando existe): o CRM rodou num banco temporário
  //     e o principal voltou. Diz de que provedor é cada um (nunca o endereço)
  //     e se o provisório ainda responde — é de lá que Configurações traz os
  //     dados da semana.
  linhas.push("— Banco provisório (para trazer os dados de volta)");
  if (!process.env.DATABASE_URL_PROVISORIO) {
    linhas.push("   não há DATABASE_URL_PROVISORIO — nada a trazer.");
  } else {
    const { provedorDoEndereco, mesmoBanco } = await import("@/lib/trazer-provisorio-regra");
    linhas.push(`   principal: ${provedorDoEndereco(process.env.DATABASE_URL)} · provisório: ${provedorDoEndereco(process.env.DATABASE_URL_PROVISORIO)}`);
    if (mesmoBanco(process.env.DATABASE_URL, process.env.DATABASE_URL_PROVISORIO)) {
      linhas.push("   ATENÇÃO: DATABASE_URL ainda aponta para o provisório. Troque para o principal antes de trazer.");
    }
    linhas.push(await testar("conectar no provisório", async () => {
      const { PrismaClient } = await import("@prisma/client");
      const prov = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_PROVISORIO } } });
      try {
        const r = await prov.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM "Cliente"`);
        return `respondeu — ${r[0]?.n ?? 0} cliente(s) lá`;
      } finally {
        await prov.$disconnect().catch(() => {});
      }
    }));
  }
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
  // O que o letreiro mostra e de onde veio cada número — e cada fonte testada
  // ao vivo, para saber QUAL caiu quando uma cotação some (01/10: o dólar
  // sumiu e o rodízio repetia o café no lugar dele).
  const num = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
  linhas.push(await testar("cotações (café/dólar)", async () => {
    const { obterCotacoes } = await import("@/lib/mercado");
    const c = await obterCotacoes();
    const es = c.cafeES;
    return [
      `bolsa: ${c.fonte ?? "?"}, lida ${c.cafeAtualizadoEm ?? "nunca"}, arábica ${num(c.cafeArabica)}, conilon ${num(c.cafeConilon)}`,
      `café do ES: ${es ? `${es.fonte}, lido ${es.atualizadoEm}, arábica ${num(es.arabica)}, conilon ${num(es.conilon)}, dólar ${num(es.dolar)}` : "nunca lido"}`,
      `dólar: ${num(c.dolar)} (${c.dolarFonte ?? "fonte ?"}, lido ${c.dolarLidoEm ?? "?"})`,
    ].join(" · ");
  }));
  linhas.push(await testar("dólar ao vivo — AwesomeAPI", async () => {
    const { buscarDolarAwesome } = await import("@/lib/mercado");
    const d = await buscarDolarAwesome();
    if (!d) throw new Error("não respondeu, ou respondeu sem valor de dólar");
    return `R$ ${num(d.valor)}`;
  }));
  linhas.push(await testar("dólar ao vivo — Yahoo (reserva)", async () => {
    const { buscarDolarYahoo } = await import("@/lib/mercado");
    const d = await buscarDolarYahoo();
    if (!d) throw new Error("não respondeu, ou respondeu sem valor de dólar");
    return `R$ ${num(d.valor)}`;
  }));
  linhas.push(await testar("Painel do Café ao vivo", async () => {
    const { fontePainelDoCafe } = await import("@/lib/cafe-es");
    const l = await fontePainelDoCafe();
    if (!l) throw new Error("não respondeu, ou o formato mudou e o leitor não achou o café");
    return `conilon ${num(l.conilon)}, arábica ${num(l.arabica)}, dólar ${l.dolar == null ? "NÃO VEIO" : num(l.dolar)}`;
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
