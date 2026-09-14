import { db } from "./db";

let applied = false;

// Migração incremental segura — adiciona colunas/tabelas que ainda não existem.
// Idempotente: pode rodar várias vezes sem erro.
export async function aplicarMigracoes(): Promise<void> {
  if (applied) return;
  applied = true;
  try {
    await db.$executeRawUnsafe(`
      ALTER TABLE "Cliente"
        ADD COLUMN IF NOT EXISTS "status"        TEXT NOT NULL DEFAULT 'potencial',
        ADD COLUMN IF NOT EXISTS "proximaVisita"     TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "proximaVisitaNota" TEXT,
        ADD COLUMN IF NOT EXISTS "resumoMaquinas"    TEXT,
        ADD COLUMN IF NOT EXISTS "resumoValor"       DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "resumoEntrada"     DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "resumoCondicao"    TEXT,
        ADD COLUMN IF NOT EXISTS "resumoTexto"       TEXT,
        ADD COLUMN IF NOT EXISTS "leadScore"         INTEGER NOT NULL DEFAULT 50,
        ADD COLUMN IF NOT EXISTS "leadScoreAtualizadoEm" TIMESTAMP WITH TIME ZONE
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cliente_leadScore_idx" ON "Cliente" ("leadScore")`);
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ClienteMaquina" (
        "id"        TEXT NOT NULL,
        "clienteId" TEXT NOT NULL,
        "marca"     TEXT NOT NULL,
        "modelo"    TEXT NOT NULL,
        "criadoEm"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "ClienteMaquina_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "ClienteMaquina_clienteId_fkey"
          FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE
      )
    `);

    // Fases 2-4 do PROJETO ZEUS (pipeline, Cérebro agêntico, ZEUS 24/7) e a
    // Fase 2B (Comparativo 2.0) criaram modelos novos no schema.prisma, mas o
    // build não roda mais `prisma db push` — sem isto, as tabelas nunca
    // seriam criadas em produção e todas as rotas que as usam quebrariam.
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ZeusEvent" (
        "id"         TEXT NOT NULL,
        "tipo"       TEXT NOT NULL,
        "severidade" TEXT NOT NULL DEFAULT 'media',
        "titulo"     TEXT NOT NULL,
        "detalhe"    TEXT,
        "resolvido"  BOOLEAN NOT NULL DEFAULT false,
        "criadoEm"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "ZeusEvent_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ZeusEvent_tipo_criadoEm_idx" ON "ZeusEvent" ("tipo", "criadoEm")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ZeusEvent_resolvido_idx" ON "ZeusEvent" ("resolvido")`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CerebroSession" (
        "id"           TEXT NOT NULL,
        "titulo"       TEXT,
        "criadoEm"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "atualizadoEm" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "CerebroSession_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CerebroMessage" (
        "id"        TEXT NOT NULL,
        "sessionId" TEXT NOT NULL,
        "role"      TEXT NOT NULL,
        "content"   TEXT NOT NULL,
        "criadoEm"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "CerebroMessage_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "CerebroMessage_sessionId_fkey"
          FOREIGN KEY ("sessionId") REFERENCES "CerebroSession"("id") ON DELETE CASCADE
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CerebroMessage_sessionId_criadoEm_idx" ON "CerebroMessage" ("sessionId", "criadoEm")`);

    // Fase 2B — Comparativo 2.0: conhecimento do vendedor por máquina/concorrente.
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NotaMaquina" (
        "id"            TEXT NOT NULL,
        "maquinaId"     TEXT NOT NULL,
        "concorrenteId" TEXT,
        "texto"         TEXT NOT NULL,
        "criadoEm"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "NotaMaquina_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "NotaMaquina_maquinaId_fkey"
          FOREIGN KEY ("maquinaId") REFERENCES "Maquina"("id") ON DELETE CASCADE
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "NotaMaquina_maquinaId_idx" ON "NotaMaquina" ("maquinaId")`);

    // Fase 2 — pipeline automático do WhatsApp: marca cada mensagem recebida
    // como processada (webhook em tempo real + cron de fallback). Sem esta
    // coluna, toda leitura/escrita em WhatsAppMessage quebra (e com ela o
    // pipeline inteiro e o ZEUS, que dependem de processar mensagens).
    await db.$executeRawUnsafe(`ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP WITH TIME ZONE`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WhatsAppMessage_sendStatus_idx" ON "WhatsAppMessage" ("sendStatus")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WhatsAppMessage_processedAt_idx" ON "WhatsAppMessage" ("processedAt")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "WhatsAppConversation_agnesScheduledAt_idx" ON "WhatsAppConversation" ("agnesScheduledAt")`);

    // Orientador de Vendas: snapshot mais recente da análise de coaching
    // comercial de IA por cliente (estágio, objeções, temperatura, etc.).
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OrientadorAnalise" (
        "id"                      TEXT NOT NULL,
        "clienteId"               TEXT NOT NULL,
        "estagioVenda"            TEXT NOT NULL,
        "perfilComprador"         TEXT,
        "objecoes"                TEXT[] NOT NULL DEFAULT '{}',
        "probabilidadeFechamento" INTEGER,
        "probabilidadeExplicacao" TEXT,
        "temperatura"             TEXT NOT NULL,
        "proximaAcao"             TEXT,
        "melhorResposta"          TEXT,
        "oportunidadesPerdidas"   TEXT[] NOT NULL DEFAULT '{}',
        "resumoNegociacao"        TEXT,
        "atualizadoEm"            TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "OrientadorAnalise_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "OrientadorAnalise_clienteId_key" UNIQUE ("clienteId"),
        CONSTRAINT "OrientadorAnalise_clienteId_fkey"
          FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE
      )
    `);

    // Setor de Aplicações & Nichos: nichos/segmentos de mercado e operações
    // que cada máquina própria realiza (gerado por IA, editável).
    await db.$executeRawUnsafe(`ALTER TABLE "Maquina" ADD COLUMN IF NOT EXISTS "aplicacoes" TEXT`);

    // Setor de Pós-venda: histórico de contatos com clientes que já compraram.
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PosVendaContato" (
        "id"        TEXT NOT NULL,
        "clienteId" TEXT NOT NULL,
        "tipo"      TEXT NOT NULL,
        "nota"      TEXT NOT NULL,
        "data"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "criadoEm"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "PosVendaContato_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "PosVendaContato_clienteId_fkey"
          FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PosVendaContato_clienteId_data_idx" ON "PosVendaContato" ("clienteId", "data")`);

    // Relatório de conversas do WhatsApp (PDF): cache do resumo IA por conversa.
    await db.$executeRawUnsafe(`
      ALTER TABLE "WhatsAppConversation"
        ADD COLUMN IF NOT EXISTS "resumoRelatorio"   TEXT,
        ADD COLUMN IF NOT EXISTS "resumoRelatorioEm" TIMESTAMP WITH TIME ZONE
    `);

    // Orientador de Vendas: card ocultado (X / ✓ negociação) até nova mensagem.
    await db.$executeRawUnsafe(`ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "orientadorOcultoEm" TIMESTAMP WITH TIME ZONE`);

    // Google Agenda (OAuth real): id do evento criado para cada visita.
    await db.$executeRawUnsafe(`ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT`);

    // Limpeza (v7): tabelas de telas excluídas (marketing, mídia, resumos
    // colados, sugestões de vínculo, metas/frases antigas). Nenhuma tela lia
    // nelas; o Prisma já não as conhece. Ordem respeita as chaves estrangeiras.
    for (const t of ["AnaliseIA", "Conversa", "SugestaoVinculo", "MidiaPost", "CampanhaMarketing", "Motivacao", "Meta"]) {
      await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "${t}" CASCADE`);
    }

    // Proposta comercial de uma página + calculadora de custo por hora (v8).
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Proposta" (
        "id"           TEXT NOT NULL,
        "negociacaoId" TEXT NOT NULL,
        "dados"        TEXT NOT NULL,
        "enviadaEm"    TIMESTAMP WITH TIME ZONE,
        "criadoEm"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "atualizadoEm" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "Proposta_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Proposta_negociacaoId_key" UNIQUE ("negociacaoId"),
        CONSTRAINT "Proposta_negociacaoId_fkey"
          FOREIGN KEY ("negociacaoId") REFERENCES "Negociacao"("id") ON DELETE CASCADE
      )
    `);
  } catch (e) {
    console.error("[migracoes] erro ao aplicar:", e);
  }
}
