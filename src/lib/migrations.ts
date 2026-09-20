import { db } from "./db";
import { RENOMEAR_DYNAPAC, DYNAPAC_FORA_DE_LINHA } from "./dynapac-catalogo";

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

    // Cadência de follow-up de 7 toques (v9).
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Cadencia" (
        "id"                 TEXT NOT NULL,
        "clienteId"          TEXT NOT NULL,
        "tipo"               TEXT NOT NULL DEFAULT 'geral',
        "toqueAtual"         INTEGER NOT NULL DEFAULT 0,
        "proximoToqueEm"     TIMESTAMP WITH TIME ZONE NOT NULL,
        "ativa"              BOOLEAN NOT NULL DEFAULT TRUE,
        "iniciadaEm"         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "encerradaEm"        TIMESTAMP WITH TIME ZONE,
        "motivoEncerramento" TEXT,
        CONSTRAINT "Cadencia_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "Cadencia_clienteId_fkey"
          FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cadencia_ativa_proximoToqueEm_idx" ON "Cadencia"("ativa", "proximoToqueEm")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cadencia_clienteId_idx" ON "Cadencia"("clienteId")`);

    // Funil robusto (v10): papel e probabilidade por coluna. O papel deixa de
    // ser adivinhado pelo título; o backfill abaixo usa as palavras antigas
    // uma única vez, para as colunas que já existem.
    await db.$executeRawUnsafe(`ALTER TABLE "ColunaFunil" ADD COLUMN IF NOT EXISTS "papel" TEXT`);
    await db.$executeRawUnsafe(`ALTER TABLE "ColunaFunil" ADD COLUMN IF NOT EXISTS "probabilidade" INTEGER NOT NULL DEFAULT 50`);
    await db.$executeRawUnsafe(`UPDATE "ColunaFunil" SET "papel" = 'perdida', "probabilidade" = 0 WHERE "papel" IS NULL AND titulo ILIKE '%perdid%'`);
    await db.$executeRawUnsafe(`UPDATE "ColunaFunil" SET "papel" = 'faturado', "probabilidade" = 100 WHERE "papel" IS NULL AND titulo ILIKE '%faturad%'`);
    await db.$executeRawUnsafe(`UPDATE "ColunaFunil" SET "papel" = 'confirmada', "probabilidade" = 90 WHERE "papel" IS NULL AND (titulo ILIKE '%confirm%' OR titulo ILIKE '%aprovad%' OR titulo ILIKE '%vendid%' OR titulo ILIKE '%ganh%')`);
    await db.$executeRawUnsafe(`UPDATE "ColunaFunil" SET "papel" = 'banco', "probabilidade" = 70 WHERE "papel" IS NULL AND (titulo ILIKE '%banco%' OR titulo ILIKE '%bcnh%')`);
    await db.$executeRawUnsafe(`UPDATE "ColunaFunil" SET "papel" = 'em_negociacao', "probabilidade" = 20 WHERE "papel" IS NULL AND titulo ILIKE '%primeiro%'`);
    await db.$executeRawUnsafe(`UPDATE "ColunaFunil" SET "papel" = 'em_negociacao', "probabilidade" = 35 WHERE "papel" IS NULL AND titulo ILIKE '%pendente%'`);
    await db.$executeRawUnsafe(`UPDATE "ColunaFunil" SET "papel" = 'em_negociacao', "probabilidade" = 50 WHERE "papel" IS NULL`);

    // Usada na troca dentro da negociação (v10).
    await db.$executeRawUnsafe(`
      ALTER TABLE "Negociacao"
        ADD COLUMN IF NOT EXISTS "usadaTroca"     BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS "usadaMarca"     TEXT,
        ADD COLUMN IF NOT EXISTS "usadaModelo"    TEXT,
        ADD COLUMN IF NOT EXISTS "usadaAno"       INTEGER,
        ADD COLUMN IF NOT EXISTS "usadaHorimetro" INTEGER,
        ADD COLUMN IF NOT EXISTS "usadaEstado"    TEXT,
        ADD COLUMN IF NOT EXISTS "usadaValor"     DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "usadaObs"       TEXT,
        ADD COLUMN IF NOT EXISTS "usadaEstoqueId" TEXT
    `);

    // Resposta automática com janela de horário e limite diário (v11).
    await db.$executeRawUnsafe(`
      ALTER TABLE "WhatsAppSettings"
        ADD COLUMN IF NOT EXISTS "autoHoraInicio" INTEGER NOT NULL DEFAULT 7,
        ADD COLUMN IF NOT EXISTS "autoHoraFim"    INTEGER NOT NULL DEFAULT 20,
        ADD COLUMN IF NOT EXISTS "autoLimiteDia"  INTEGER NOT NULL DEFAULT 40
    `);

    // Respostas prontas do WhatsApp (v12).
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RespostaPronta" (
        "id"       TEXT NOT NULL,
        "titulo"   TEXT NOT NULL,
        "texto"    TEXT NOT NULL,
        "ordem"    INTEGER NOT NULL DEFAULT 0,
        "criadoEm" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "RespostaPronta_pkey" PRIMARY KEY ("id")
      )
    `);

    // Demandas como lista única (v13) + cidade da visita.
    await db.$executeRawUnsafe(`
      ALTER TABLE "TarefaKanban"
        ADD COLUMN IF NOT EXISTS "prioridade"  TEXT NOT NULL DEFAULT 'normal',
        ADD COLUMN IF NOT EXISTS "origem"      TEXT NOT NULL DEFAULT 'manual',
        ADD COLUMN IF NOT EXISTS "chave"       TEXT,
        ADD COLUMN IF NOT EXISTS "concluidaEm" TIMESTAMP WITH TIME ZONE
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TarefaKanban_coluna_dueDate_idx" ON "TarefaKanban"("coluna", "dueDate")`);
    // Tarefas de colunas personalizadas antigas viram "abertas".
    await db.$executeRawUnsafe(`UPDATE "TarefaKanban" SET "coluna" = 'demandas' WHERE "coluna" NOT IN ('demandas', 'demandas_concluida')`);
    await db.$executeRawUnsafe(`ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "cidade" TEXT`);
    await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "ColunaDemanda"`);

    // Itens resolvidos da Central de alertas (v14).
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "AlertaOculto" (
        "id"        TEXT NOT NULL,
        "chave"     TEXT NOT NULL,
        "clienteId" TEXT,
        "ocultoEm"  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "AlertaOculto_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "AlertaOculto_chave_key" ON "AlertaOculto"("chave")`);

    // Confirmação de visitas (v15): status, data da realização e reagendamento.
    // As visitas antigas (já passadas) entram como realizadas UMA vez, só
    // quando a coluna nasce — depois disso, quem decide é o ✓/✗ do vendedor.
    const colStatus = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'Visita' AND column_name = 'status'`);
    const statusJaExistia = (colStatus?.[0]?.n ?? 0) > 0;
    await db.$executeRawUnsafe(`
      ALTER TABLE "Visita"
        ADD COLUMN IF NOT EXISTS "status"         TEXT NOT NULL DEFAULT 'agendada',
        ADD COLUMN IF NOT EXISTS "realizadaEm"    TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "reagendadaDeId" TEXT
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Visita_status_data_idx" ON "Visita"("status", "data")`);
    if (!statusJaExistia) {
      await db.$executeRawUnsafe(`UPDATE "Visita" SET "status" = 'realizada', "realizadaEm" = "data" WHERE "status" = 'agendada' AND "data" < NOW() - interval '1 day'`);
    }

    // Google Contatos ↔ clientes (v16): vínculo com o contato do Google.
    await db.$executeRawUnsafe(`
      ALTER TABLE "Cliente"
        ADD COLUMN IF NOT EXISTS "googleContatoId"      TEXT,
        ADD COLUMN IF NOT EXISTS "googleSincronizadoEm" TIMESTAMP WITH TIME ZONE
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cliente_googleContatoId_idx" ON "Cliente"("googleContatoId")`);

    // Contatos bloqueados (v17): telefones que nunca entram no CRM.
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ContatoBloqueado" (
        "id"       TEXT NOT NULL,
        "telefone" TEXT NOT NULL,
        "nome"     TEXT,
        "motivo"   TEXT,
        "criadoEm" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT "ContatoBloqueado_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ContatoBloqueado_telefone_key" ON "ContatoBloqueado"("telefone")`);

    // Orientador (v18): combinados e pendências da conversa.
    await db.$executeRawUnsafe(`
      ALTER TABLE "OrientadorAnalise"
        ADD COLUMN IF NOT EXISTS "combinados" TEXT[] NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "pendencias" TEXT[] NOT NULL DEFAULT '{}'
    `);

    // Orientador (v19): coaching completo em JSON.
    await db.$executeRawUnsafe(`ALTER TABLE "OrientadorAnalise" ADD COLUMN IF NOT EXISTS "coaching" JSONB`);

    // Alerta (v21): no máximo um alerta ABERTO por cliente+tipo — trava no
    // banco a corrida entre chamadas concorrentes (ex.: webhook + fallback do
    // cron do Orientador quase ao mesmo tempo) que criavam alertas duplicados
    // para o mesmo cliente mesmo com o "verifica antes de criar" no código.
    // Primeiro resolve os duplicados que já existem (mantém só o mais
    // recente de cada cliente+tipo) — senão o índice único abaixo falha ao
    // criar por já existirem linhas repetidas.
    await db.$executeRawUnsafe(`
      UPDATE "Alerta" a SET "resolvido" = true
      WHERE a."resolvido" = false
        AND a."id" <> (
          SELECT b."id" FROM "Alerta" b
          WHERE b."clienteId" = a."clienteId" AND b."tipo" = a."tipo" AND b."resolvido" = false
          ORDER BY b."criadoEm" DESC, b."id" DESC
          LIMIT 1
        )
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Alerta_clienteId_tipo_aberto_key"
        ON "Alerta" ("clienteId", "tipo") WHERE "resolvido" = false
    `);

    // Cliente (v21): índice para a lista "aguardando resposta" da Central de
    // Alertas, que hoje varre a tabela inteira toda vez que a página carrega.
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cliente_aguardandoResposta_ultimoContato_idx" ON "Cliente" ("aguardandoResposta", "ultimoContato")`);

    // AlertaOculto (v22): "aguardando"/"atacar" não usam mais AlertaOculto
    // (ver ocultarItemCentralAction) — limpa o que já tinha acumulado lá,
    // que só inflava a tabela sem servir mais pra nada.
    await db.$executeRawUnsafe(`DELETE FROM "AlertaOculto" WHERE "chave" LIKE 'aguardando:%' OR "chave" LIKE 'atacar:%'`);

    // ZeusEvent (v23): mesmo problema do Alerta — um evento de erro repetido
    // (ex.: rate limit do Groq) virava uma linha nova a cada ocorrência.
    // Adiciona o contador de ocorrências, unifica o que já duplicou (mantém
    // só o mais recente de cada tipo+título, soma as ocorrências no que
    // sobra) e trava um índice único pra nunca mais duplicar.
    await db.$executeRawUnsafe(`ALTER TABLE "ZeusEvent" ADD COLUMN IF NOT EXISTS "ocorrencias" INTEGER NOT NULL DEFAULT 1`);
    // Soma as ocorrências no mais recente de cada grupo ANTES de resolver os
    // outros — se fizesse na ordem inversa, o "count(*) > 1" do segundo passo
    // já não veria mais os duplicados (foram resolvidos no primeiro).
    await db.$executeRawUnsafe(`
      WITH grupos AS (
        SELECT tipo, titulo, count(*) AS qtd, max("criadoEm") AS mais_recente
        FROM "ZeusEvent" WHERE "resolvido" = false GROUP BY tipo, titulo HAVING count(*) > 1
      )
      UPDATE "ZeusEvent" z SET "ocorrencias" = g.qtd
      FROM grupos g
      WHERE z."resolvido" = false AND z.tipo = g.tipo AND z.titulo = g.titulo AND z."criadoEm" = g.mais_recente
    `);
    await db.$executeRawUnsafe(`
      WITH grupos AS (
        SELECT tipo, titulo, max("criadoEm") AS mais_recente
        FROM "ZeusEvent" WHERE "resolvido" = false GROUP BY tipo, titulo HAVING count(*) > 1
      )
      UPDATE "ZeusEvent" z SET "resolvido" = true
      FROM grupos g
      WHERE z."resolvido" = false AND z.tipo = g.tipo AND z.titulo = g.titulo AND z."criadoEm" < g.mais_recente
    `);
    await db.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ZeusEvent_tipo_titulo_aberto_key"
        ON "ZeusEvent" ("tipo", "titulo") WHERE "resolvido" = false
    `);

    // ConversaExcluida (v24): registro de conversa de WhatsApp apagada pelo
    // vendedor — só mensagem posterior à exclusão pode recriá-la (ver
    // lib/whatsapp-corte.ts). A data de corte inicial e a limpeza das
    // conversas antigas rodam em manutencao.ts (precisam do Prisma Client).
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ConversaExcluida" (
        "telefone" TEXT NOT NULL,
        "excluidaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ConversaExcluida_pkey" PRIMARY KEY ("telefone")
      )
    `);

    // Unificação de cadastros duplicados (v25): histórico de cada rodada
    // (para desfazer) e redirecionamento dos links dos cadastros que sumiram.
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UnificacaoClientes" (
        "id" TEXT NOT NULL,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "origem" TEXT NOT NULL DEFAULT 'usuario',
        "resumo" TEXT NOT NULL,
        "dados" TEXT NOT NULL,
        "desfeitaEm" TIMESTAMP(3),
        CONSTRAINT "UnificacaoClientes_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ClienteRedirecionamento" (
        "deId" TEXT NOT NULL,
        "paraId" TEXT NOT NULL,
        "unificacaoId" TEXT NOT NULL,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ClienteRedirecionamento_pkey" PRIMARY KEY ("deId")
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ClienteRedirecionamento_unificacaoId_idx" ON "ClienteRedirecionamento" ("unificacaoId")`);

    // Evento (v26): compromisso de vários dias que não é visita a cliente
    // (feira, convenção, viagem), com UF própria — pode ser fora do ES.
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Evento" (
        "id" TEXT NOT NULL,
        "titulo" TEXT NOT NULL,
        "inicio" TIMESTAMP(3) NOT NULL,
        "fim" TIMESTAMP(3) NOT NULL,
        "diaInteiro" BOOLEAN NOT NULL DEFAULT true,
        "uf" TEXT,
        "cidade" TEXT,
        "observacao" TEXT,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Evento_inicio_fim_idx" ON "Evento" ("inicio", "fim")`);

    // ConversaExcluida.motivo (v27): separa a conversa que o vendedor apagou
    // ("manual", nunca volta) da que a data de corte apagou ("corte", volta
    // se ele importar o histórico de antes do corte).
    await db.$executeRawUnsafe(`ALTER TABLE "ConversaExcluida" ADD COLUMN IF NOT EXISTS "motivo" TEXT NOT NULL DEFAULT 'manual'`);

    // LimpezaClientes (v28): recibo de cada limpeza de cadastros sem identidade.
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LimpezaClientes" (
        "id" TEXT NOT NULL,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "origem" TEXT NOT NULL DEFAULT 'usuario',
        "resumo" TEXT NOT NULL,
        "dados" TEXT NOT NULL,
        "desfeitaEm" TIMESTAMP(3),
        CONSTRAINT "LimpezaClientes_pkey" PRIMARY KEY ("id")
      )
    `);

    // Cliente.dataNascimento (v29): aniversário do cliente, para a mensagem
    // de parabéns; a origem diz se foi digitado ou lido de um documento.
    await db.$executeRawUnsafe(`ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "dataNascimento" TIMESTAMP(3)`);
    await db.$executeRawUnsafe(`ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "dataNascimentoOrigem" TEXT`);

    // MidiaEnvio (v29): anexo ou arte de uma mensagem em massa, guardado uma
    // vez e reaproveitado em cada lote de envio.
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MidiaEnvio" (
        "id" TEXT NOT NULL,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "mimeType" TEXT NOT NULL,
        "nome" TEXT NOT NULL,
        "tipo" TEXT NOT NULL,
        "origem" TEXT NOT NULL,
        "base64" TEXT NOT NULL,
        CONSTRAINT "MidiaEnvio_pkey" PRIMARY KEY ("id")
      )
    `);
    // ── Central Inteligente do Cérebro (v30) ───────────────────────────────
    // Relatório do fim do dia, radar de inovação, posts de marketing e as
    // memórias ensinadas ao Cérebro.
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RelatorioDiario" (
        "id" TEXT NOT NULL,
        "dia" TIMESTAMP(3) NOT NULL,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "resumo" TEXT NOT NULL,
        "dados" TEXT NOT NULL,
        "totalConversas" INTEGER NOT NULL DEFAULT 0,
        "negociacoes" INTEGER NOT NULL DEFAULT 0,
        "novos" INTEGER NOT NULL DEFAULT 0,
        "carteira" INTEGER NOT NULL DEFAULT 0,
        "enviadoEm" TIMESTAMP(3),
        CONSTRAINT "RelatorioDiario_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "RelatorioDiario_dia_key" ON "RelatorioDiario" ("dia")`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "IdeiaInovacao" (
        "id" TEXT NOT NULL,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "sessao" TEXT NOT NULL,
        "titulo" TEXT NOT NULL,
        "melhoria" TEXT NOT NULL,
        "beneficio" TEXT NOT NULL,
        "ganho" TEXT NOT NULL,
        "esforco" TEXT NOT NULL DEFAULT 'medio',
        "fonte" TEXT,
        "status" TEXT NOT NULL DEFAULT 'nova',
        CONSTRAINT "IdeiaInovacao_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IdeiaInovacao_status_criadoEm_idx" ON "IdeiaInovacao" ("status", "criadoEm")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "IdeiaInovacao_sessao_idx" ON "IdeiaInovacao" ("sessao")`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "PostMarketing" (
        "id" TEXT NOT NULL,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "tipo" TEXT NOT NULL,
        "tema" TEXT NOT NULL,
        "legenda" TEXT NOT NULL,
        "hashtags" TEXT NOT NULL DEFAULT '',
        "maquina" TEXT,
        "imagemBase64" TEXT,
        "imagemMime" TEXT,
        "agendadoPara" TIMESTAMP(3),
        "status" TEXT NOT NULL DEFAULT 'rascunho',
        "publicadoEm" TIMESTAMP(3),
        "canal" TEXT,
        CONSTRAINT "PostMarketing_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PostMarketing_status_agendadoPara_idx" ON "PostMarketing" ("status", "agendadoPara")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PostMarketing_criadoEm_idx" ON "PostMarketing" ("criadoEm")`);

    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "MemoriaCerebro" (
        "id" TEXT NOT NULL,
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "titulo" TEXT NOT NULL,
        "conteudo" TEXT NOT NULL,
        "origem" TEXT NOT NULL DEFAULT 'texto',
        "sessao" TEXT,
        CONSTRAINT "MemoriaCerebro_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MemoriaCerebro_criadoEm_idx" ON "MemoriaCerebro" ("criadoEm")`);

    // NotaContextoCliente (v31): o que o vendedor conta sobre o cliente fora
    // da conversa do WhatsApp e passa a valer para sempre.
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "NotaContextoCliente" (
        "id" TEXT NOT NULL,
        "clienteId" TEXT NOT NULL,
        "texto" TEXT NOT NULL,
        "origem" TEXT NOT NULL DEFAULT 'vendedor',
        "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "NotaContextoCliente_pkey" PRIMARY KEY ("id")
      )
    `);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "NotaContextoCliente_clienteId_criadoEm_idx" ON "NotaContextoCliente" ("clienteId", "criadoEm")`);
    await db.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "NotaContextoCliente"
          ADD CONSTRAINT "NotaContextoCliente_clienteId_fkey"
          FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // ── Nota do vendedor para o Orientador (v31) ───────────────────────────
    // O que o vendedor sabe e o WhatsApp não mostra (conversa por telefone,
    // visita, o que o cliente falou por fora). Ele escreve na tela e vai
    // junto no próximo "Reanalisar".
    await db.$executeRawUnsafe(`ALTER TABLE "OrientadorAnalise" ADD COLUMN IF NOT EXISTS "notaVendedor" TEXT`);

    // ── Catálogo Dynapac atualizado (v30) ──────────────────────────────────
    // Os rolos de solo passam a usar o nome curto da fábrica (CA6500 D →
    // CA65 D). Renomear em vez de recriar preserva ficha técnica, notas,
    // fotos e o histórico de cada máquina. As negociações que citam o nome
    // antigo acompanham a troca para o funil não mostrar modelo inexistente.
    for (const [antigo, novo] of Object.entries(RENOMEAR_DYNAPAC)) {
      // Se o nome novo já existe (banco novo, que já nasceu com o catálogo
      // atual), o antigo é duplicata: apaga em vez de renomear (o UNIQUE
      // marca+modelo recusaria o UPDATE).
      await db.$executeRawUnsafe(
        `DELETE FROM "Maquina" WHERE "marca" = 'Dynapac' AND "modelo" = $1
           AND EXISTS (SELECT 1 FROM "Maquina" m2 WHERE m2."marca" = 'Dynapac' AND m2."modelo" = $2)`,
        antigo, novo,
      );
      await db.$executeRawUnsafe(
        `UPDATE "Maquina" SET "modelo" = $2 WHERE "marca" = 'Dynapac' AND "modelo" = $1`,
        antigo, novo,
      );
      await db.$executeRawUnsafe(
        `UPDATE "Negociacao" SET "maquinaModelo" = $2 WHERE "maquinaModelo" = $1`,
        antigo, novo,
      );
    }
    // Modelos fora de linha sem equivalente: sai do catálogo (as negociações
    // antigas guardam o nome como texto e continuam intactas).
    for (const fora of DYNAPAC_FORA_DE_LINHA) {
      await db.$executeRawUnsafe(
        `DELETE FROM "NotaMaquina" WHERE "maquinaId" IN (SELECT "id" FROM "Maquina" WHERE "marca" = 'Dynapac' AND "modelo" = $1)`,
        fora,
      );
      await db.$executeRawUnsafe(`DELETE FROM "Maquina" WHERE "marca" = 'Dynapac' AND "modelo" = $1`, fora);
    }
  } catch (e) {
    console.error("[migracoes] erro ao aplicar:", e);
  }
}
