// O CRM NASCE NUM BANCO VAZIO.
//
// Por que existe: o banco de produção (Neon) ficou suspenso por cota, e a
// única saída grátis para o CRM voltar no mesmo dia era apontar para um banco
// novo, em outro provedor. Só que um banco novo é um banco VAZIO — sem
// nenhuma tabela — e o CRM contava com a estrutura ter sido criada um dia por
// `prisma db push`, que não roda em produção. Resultado: toda tela caía.
//
// Agora, ao abrir qualquer tela, se a tabela Configuracao não existe, o CRM
// cria a estrutura inteira (gerada do schema.prisma, em lib/banco-do-zero-ddl.ts)
// e segue. A manutenção normal vem em seguida e povoa o que é de referência
// (municípios, regiões, catálogo de máquinas, fichas).
//
// Isto também é o plano de desastre: perdeu o banco, aponta para um vazio e o
// CRM se recompõe. Os DADOS, esses só voltam de backup — a estrutura, sim.

import { db } from "@/lib/db";
import { DDL_DO_ZERO } from "@/lib/banco-do-zero-ddl";

/** Um SELECT: a tabela de configuração existe? Sem ela, não existe nada. */
export async function bancoEstaVazio(): Promise<boolean> {
  const r = await db.$queryRawUnsafe<{ t: string | null }[]>(`SELECT to_regclass('public."Configuracao"')::text AS t`);
  return !r?.[0]?.t;
}

export type ResultadoDoZero = { situacao: "ja-existia" } | { situacao: "criado"; comandos: number; pulados: number };

let confirmado = false;

/**
 * Cria a estrutura se o banco estiver vazio. Idempotente e tolerante a duas
 * lambdas ao mesmo tempo: "already exists" é pulado, qualquer outro erro sobe.
 */
export async function garantirBancoDoZero(): Promise<ResultadoDoZero> {
  if (confirmado) return { situacao: "ja-existia" };
  if (!(await bancoEstaVazio())) {
    confirmado = true;
    return { situacao: "ja-existia" };
  }
  console.warn(`[banco do zero] banco vazio — criando a estrutura (${DDL_DO_ZERO.length} comandos).`);
  let pulados = 0;
  for (const sql of DDL_DO_ZERO) {
    try {
      await db.$executeRawUnsafe(sql);
    } catch (e) {
      if (/already exists|já existe/i.test(String((e as Error)?.message ?? e))) { pulados += 1; continue; }
      throw e;
    }
  }
  confirmado = true;
  console.warn(`[banco do zero] estrutura criada: ${DDL_DO_ZERO.length - pulados} comando(s), ${pulados} já existia(m).`);
  return { situacao: "criado", comandos: DDL_DO_ZERO.length, pulados };
}
