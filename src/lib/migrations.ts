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
        ADD COLUMN IF NOT EXISTS "resumoTexto"       TEXT
    `);
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
  } catch (e) {
    console.error("[migracoes] erro ao aplicar:", e);
  }
}
