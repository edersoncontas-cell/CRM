// A COLUNA QUE O SCHEMA TEM E O BANCO AINDA NÃO.
//
// Campo novo no schema.prisma: a partir do deploy, TODA consulta àquele modelo
// pede a coluna nova. Quem cria a coluna é a manutenção — que roda dentro de
// uma requisição, em paralelo com as consultas da página. Quando a consulta
// chega antes, a tela cai. Já custou um dia fora do ar (vendedorId, 23/09) e
// a tela do Orientador (notaVendedor). E a volta para o Neon tem o mesmo
// risco: não dá para saber daqui se as colunas de 22/09 (naoPerturbe) chegaram
// a ser criadas lá — com elas faltando, a 1ª rajada quebrava 3 de 10 telas.
//
// Agora, quando uma consulta cai com "a coluna X não existe", o cliente do
// banco (lib/db.ts) cria na hora as colunas que o schema tem e o banco não —
// com a definição do próprio schema (a de lib/banco-do-zero-ddl.ts, gerada
// dele) — e repete a consulta UMA vez. No caminho normal não custa nada: só
// age depois que o erro já aconteceu.
//
// O que ele NÃO faz, de propósito:
//  - tabela que não existe: criar só a tabela deixaria as chaves estrangeiras
//    para trás, e a migração (CREATE TABLE IF NOT EXISTS) não as poria depois;
//  - coluna obrigatória sem valor padrão: num banco com linhas não há como
//    criá-la sem inventar dado. Fica para a migração, e o erro sobe igual;
//  - coluna cuja migração preenche as linhas antigas SÓ quando ela nasce
//    (NASCE_PELA_MIGRACAO): criada aqui antes, a migração acharia a coluna
//    pronta e pularia o preenchimento;
//  - índice: CREATE INDEX em tabela grande trava a tabela (a suspeita de 23/09).
// Cada ALTER espera no máximo 4 s pela trava da tabela; passou disso, desiste.
//
// A manutenção continua sendo quem cria a coluna: isto só impede a tela de
// cair enquanto ela não chega. O teste de "código novo + banco velho" antes
// de empurrar continua valendo (CLAUDE.md §8).

import { DDL_DO_ZERO } from "@/lib/banco-do-zero-ddl";

/** tabela → (coluna → definição, como no schema: `BOOLEAN NOT NULL DEFAULT false`). */
export type ColunasDoSchema = Map<string, Map<string, string>>;

/** Lê as colunas de cada CREATE TABLE do DDL gerado do schema.prisma. */
export function colunasDoSchema(ddl: readonly string[] = DDL_DO_ZERO): ColunasDoSchema {
  const mapa: ColunasDoSchema = new Map();
  for (const sql of ddl) {
    const m = /^CREATE TABLE "([^"]+)" \(\n([\s\S]*)\n\)$/.exec(sql);
    if (!m) continue;
    const colunas = new Map<string, string>();
    for (const linha of m[2].split("\n")) {
      const c = /^\s+"([^"]+)" (.+?),?$/.exec(linha);
      if (c) colunas.set(c[1], c[2]);
    }
    mapa.set(m[1], colunas);
  }
  return mapa;
}

/**
 * Colunas que a migração (lib/migrations.ts) usa para saber se é a primeira
 * vez — e, sendo, preenche as linhas antigas. Se o conserto as criasse antes,
 * o preenchimento nunca rodaria. tests/coluna-que-falta.test.ts lê o
 * migrations.ts e falha enquanto uma coluna nessa situação não estiver aqui.
 */
export const NASCE_PELA_MIGRACAO = ["Visita.status"];

/** Dá para criar sem inventar dado: aceita vazio, ou tem valor padrão. */
export function criavelSemDado(definicao: string): boolean {
  return !/\bNOT NULL\b/i.test(definicao) || /\bDEFAULT\b/i.test(definicao);
}

/**
 * A consulta caiu porque falta uma coluna? P2022 é o Prisma dizendo; P2010
 * com 42703 é o Postgres dizendo numa consulta crua. Nada mais conta: erro de
 * conexão, de dado ou de trava sobe como veio.
 */
export function ehColunaQueFalta(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const codigo = (e as { code?: unknown }).code;
  if (codigo === "P2022") return true;
  const meta = (e as { meta?: { code?: unknown } }).meta;
  if (codigo === "P2010" && meta?.code === "42703") return true;
  const msg = String((e as { message?: unknown }).message ?? "");
  return /The column `[^`]+` does not exist in the current database/.test(msg);
}

export type ColunaNoBanco = { tabela: string; coluna: string };
export type Completar = {
  /** Um ALTER por tabela, com todas as colunas que faltam nela. */
  comandos: { tabela: string; colunas: string[]; sql: string }[];
  /** Faltam, mas só a migração cria: obrigatória sem padrão, ou NASCE_PELA_MIGRACAO. */
  semComoCriar: string[];
};

/**
 * O que falta, comparando o banco com o schema. Só nas tabelas que existem no
 * banco; tabela inteira faltando não é daqui (ver o topo do arquivo).
 */
export function oQueFalta(noBanco: ColunaNoBanco[], schema: ColunasDoSchema = colunasDoSchema()): Completar {
  const existentes = new Map<string, Set<string>>();
  for (const { tabela, coluna } of noBanco) {
    if (!existentes.has(tabela)) existentes.set(tabela, new Set());
    existentes.get(tabela)!.add(coluna);
  }
  const comandos: Completar["comandos"] = [];
  const semComoCriar: string[] = [];
  for (const [tabela, colunas] of schema) {
    const tem = existentes.get(tabela);
    if (!tem) continue;
    const criaveis: [string, string][] = [];
    for (const [coluna, definicao] of colunas) {
      if (tem.has(coluna)) continue;
      if (criavelSemDado(definicao) && !NASCE_PELA_MIGRACAO.includes(`${tabela}.${coluna}`)) criaveis.push([coluna, definicao]);
      else semComoCriar.push(`${tabela}.${coluna}`);
    }
    if (!criaveis.length) continue;
    const adicoes = criaveis.map(([c, d]) => `ADD COLUMN IF NOT EXISTS "${c}" ${d}`).join(", ");
    comandos.push({ tabela, colunas: criaveis.map(([c]) => c), sql: `ALTER TABLE "${tabela}" ${adicoes}` });
  }
  return { comandos, semComoCriar };
}

/**
 * Um comando só, para ir pelo pooler do Neon (que não guarda SET entre
 * comandos): a espera pela trava da tabela vale só para este ALTER.
 */
export function comEsperaCurta(alter: string): string {
  return `DO $crm$ BEGIN SET LOCAL lock_timeout = '4s'; EXECUTE $alter$${alter}$alter$; END $crm$`;
}

export const SQL_COLUNAS_DO_BANCO =
  `SELECT table_name AS tabela, column_name AS coluna FROM information_schema.columns WHERE table_schema = current_schema()`;

export type ExecutorCru = {
  $queryRawUnsafe<T = unknown>(sql: string, ...valores: unknown[]): Promise<T>;
  $executeRawUnsafe(sql: string, ...valores: unknown[]): Promise<number>;
};

/** Completa o banco. Devolve o que criou e o que ficou sem como criar. */
export async function completarColunas(cliente: ExecutorCru): Promise<{ criadas: string[]; semComoCriar: string[] }> {
  const noBanco = await cliente.$queryRawUnsafe<ColunaNoBanco[]>(SQL_COLUNAS_DO_BANCO);
  const { comandos, semComoCriar } = oQueFalta(noBanco);
  const criadas: string[] = [];
  for (const c of comandos) {
    await cliente.$executeRawUnsafe(comEsperaCurta(c.sql));
    criadas.push(...c.colunas.map((col) => `${c.tabela}.${col}`));
  }
  return { criadas, semComoCriar };
}

/**
 * Quantas vezes o conserto pode rodar: um de cada vez (as dez consultas de
 * uma rajada que caem juntas esperam o MESMO conserto), e depois de um
 * conserto, 1 minuto sem outro — nesse minuto, quem cair de novo só repete a
 * consulta. Assim, coluna que não tem como ser criada custa uma consulta ao
 * catálogo por minuto, não uma por clique (foi a repetição sem freio que
 * esgotou a cota do Neon).
 */
export const JANELA_ENTRE_CONSERTOS_MS = 60_000;

export function criarConsertoDeColunas(opcoes: { agora?: () => number; avisar?: (msg: string) => void } = {}) {
  const agora = opcoes.agora ?? Date.now;
  const avisar = opcoes.avisar ?? ((m: string) => console.warn(m));
  let emAndamento: Promise<boolean> | null = null;
  let terminouEm = 0;
  let deuCerto = false;

  /** true = o banco foi conferido e completado; vale repetir a consulta. */
  return function consertar(cliente: ExecutorCru): Promise<boolean> {
    if (emAndamento) return emAndamento;
    if (terminouEm && agora() - terminouEm < JANELA_ENTRE_CONSERTOS_MS) return Promise.resolve(deuCerto);
    emAndamento = completarColunas(cliente)
      .then(
        ({ criadas, semComoCriar }) => {
          if (criadas.length) avisar(`[banco] coluna(s) que o schema tem e o banco não: criada(s) agora — ${criadas.join(", ")}`);
          if (semComoCriar.length) avisar(`[banco] faltam no banco e só a migração cria: ${semComoCriar.join(", ")}`);
          return true;
        },
        (e: unknown) => {
          const msg = (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").trim();
          avisar(`[banco] não consegui criar a coluna que falta: ${msg}`.slice(0, 400));
          return false;
        },
      )
      .then((ok) => {
        deuCerto = ok;
        terminouEm = agora();
        emAndamento = null;
        return ok;
      });
    return emAndamento;
  };
}
