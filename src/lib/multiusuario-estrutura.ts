// A ESTRUTURA do multiusuário no banco — e por que ela não pode depender da
// manutenção.
//
// O QUE DEU ERRADO (e derrubou o CRM dele)
// O schema do Prisma ganhou a coluna vendedorId em 8 modelos. A partir daí,
// TODA consulta a Cliente, Negociação, Visita e companhia pede essa coluna —
// mesmo que ninguém esteja logado. O banco dele só ganharia a coluna quando a
// manutenção rodasse, e a manutenção roda DENTRO de uma requisição, em
// paralelo com as consultas da própria página. Quem chegasse primeiro decidia:
// se a consulta chegasse antes, a tela caía em "Algo deu errado".
//
// Eu conferi o código novo com o banco já migrado. Não conferi o estado que
// ele realmente vive no dia do deploy: código novo, banco velho.
//
// A CORREÇÃO
// A estrutura passa a ser garantida no caminho da PRIMEIRA consulta (ver
// lib/db.ts), não num passo de manutenção que corre junto. Não há mais corrida
// para perder: ou a coluna já existe, ou ela é criada antes da consulta sair.
//
// Tudo aqui é idempotente (IF NOT EXISTS) e barato: ADD COLUMN sem valor
// padrão é instantâneo no Postgres, e o índice é sobre uma tabela pequena.

export const TABELAS_DO_VENDEDOR = [
  "Cliente", "Negociacao", "Visita", "WhatsAppConversation",
  "WhatsAppMessage", "TarefaKanban", "Evento", "EnvioProgramado",
] as const;

// Só o que se usa daqui — assim a função serve tanto ao cliente do banco
// quanto a qualquer transação, sem arrastar o tipo inteiro do Prisma.
export type ExecutorCru = {
  $executeRawUnsafe(sql: string, ...valores: unknown[]): Promise<number>;
  $queryRawUnsafe<T = unknown>(sql: string, ...valores: unknown[]): Promise<T>;
};

/** A coluna de dono já existe nas 8 tabelas? Um SELECT, sem escrever nada. */
export async function estruturaJaExiste(cliente: ExecutorCru): Promise<boolean> {
  const r = await cliente.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = current_schema() AND column_name = 'vendedorId'`,
  );
  return Number(r?.[0]?.n ?? 0) >= TABELAS_DO_VENDEDOR.length;
}

/**
 * Cria a tabela Usuario, a coluna vendedorId e o índice dela em cada tabela.
 *
 * Roda de novo sem estragar nada, e pode rodar em duas lambdas ao mesmo tempo:
 * IF NOT EXISTS resolve as duas coisas.
 */
export async function garantirEstruturaMultiusuario(cliente: ExecutorCru): Promise<void> {
  await cliente.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Usuario" (
      "id" TEXT PRIMARY KEY,
      "nome" TEXT NOT NULL,
      "login" TEXT NOT NULL UNIQUE,
      "senhaHash" TEXT NOT NULL,
      "papel" TEXT NOT NULL DEFAULT 'vendedor',
      "ativo" BOOLEAN NOT NULL DEFAULT true,
      "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "ultimoAcesso" TIMESTAMP(3)
    )`);

  for (const t of TABELAS_DO_VENDEDOR) {
    await cliente.$executeRawUnsafe(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "vendedorId" TEXT`);
    // Índice: TODA consulta do CRM passa a filtrar por esta coluna.
    await cliente.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "${t}_vendedorId_idx" ON "${t}" ("vendedorId")`);
  }
}
