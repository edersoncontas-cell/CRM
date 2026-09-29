// A coluna que o schema tem e o banco não — o conserto na hora.
//
// O caso que motivou: na volta para o Neon, não dá para saber se as colunas de
// 22/09 (Cliente.naoPerturbe…) chegaram a ser criadas lá. Com elas faltando, a
// 1ª rajada de telas quebrava 3 de 10 (provado com build de produção). O que
// se prova aqui é a parte pura: o que conta como "falta coluna", o que dá
// para criar sem inventar dado, o comando, e o freio (um conserto por vez,
// no máximo um por minuto — repetição sem freio já esgotou a cota do Neon).
// A prova contra Postgres de verdade (rajada, consulta crua, transação em
// lote e interativa, coluna sem como criar, tabela travada) está no commit.

import { describe, it, expect, vi } from "vitest";
import {
  colunasDoSchema, criavelSemDado, ehColunaQueFalta, oQueFalta, comEsperaCurta,
  criarConsertoDeColunas, completarColunas, JANELA_ENTRE_CONSERTOS_MS, SQL_COLUNAS_DO_BANCO, NASCE_PELA_MIGRACAO,
  type ColunaNoBanco, type ExecutorCru,
} from "@/lib/coluna-que-falta";
import { DDL_DO_ZERO } from "@/lib/banco-do-zero-ddl";
import { ehFalhaDeConexao } from "@/lib/falha-conexao";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const schema = colunasDoSchema();

/** O banco com tudo o que o schema tem — menos o que for pedido para tirar. */
function bancoCompleto(tirar: string[] = [], semTabelas: string[] = []): ColunaNoBanco[] {
  const linhas: ColunaNoBanco[] = [];
  for (const [tabela, colunas] of schema) {
    if (semTabelas.includes(tabela)) continue;
    for (const coluna of colunas.keys()) if (!tirar.includes(`${tabela}.${coluna}`)) linhas.push({ tabela, coluna });
  }
  return linhas;
}

describe("as colunas do schema, lidas do DDL gerado", () => {
  it("todas as tabelas do DDL", () => {
    const creates = DDL_DO_ZERO.filter((s) => s.startsWith("CREATE TABLE")).length;
    expect(creates).toBeGreaterThan(30);
    expect(schema.size).toBe(creates);
  });

  it("a definição é a do schema, ao pé da letra", () => {
    const cliente = schema.get("Cliente")!;
    expect(cliente.get("naoPerturbe")).toBe("BOOLEAN NOT NULL DEFAULT false");
    expect(cliente.get("naoPerturbeEm")).toBe("TIMESTAMP(3)");
    expect(cliente.get("naoPerturbeMotivo")).toBe("TEXT");
    expect(cliente.get("status")).toBe("TEXT NOT NULL DEFAULT 'potencial'");
    expect(cliente.get("atualizadoEm")).toBe("TIMESTAMP(3) NOT NULL");
  });

  it("restrição não vira coluna", () => {
    for (const colunas of schema.values()) {
      for (const [nome, def] of colunas) {
        expect(nome).not.toMatch(/_pkey|CONSTRAINT/);
        expect(def).not.toMatch(/^CONSTRAINT|,$/);
      }
    }
  });
});

describe("o que dá para criar sem inventar dado", () => {
  it("aceita vazio, ou tem valor padrão: sim", () => {
    expect(criavelSemDado("TEXT")).toBe(true);
    expect(criavelSemDado("TIMESTAMP(3)")).toBe(true);
    expect(criavelSemDado("BOOLEAN NOT NULL DEFAULT false")).toBe(true);
    expect(criavelSemDado("TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP")).toBe(true);
  });
  it("obrigatória sem padrão: não — num banco com linhas, só inventando valor", () => {
    expect(criavelSemDado("TIMESTAMP(3) NOT NULL")).toBe(false);
    expect(criavelSemDado("TEXT NOT NULL")).toBe(false);
  });
});

describe("o que conta como coluna que falta", () => {
  it("o erro da 1ª rajada no banco simulado do Neon, ao pé da letra", () => {
    const e = Object.assign(new Error("\nInvalid `prisma.cliente.findMany()` invocation:\n\nThe column `Cliente.naoPerturbe` does not exist in the current database."), {
      code: "P2022", meta: { modelName: "Cliente", column: "Cliente.naoPerturbe" },
    });
    expect(ehColunaQueFalta(e)).toBe(true);
    // E NÃO é falha de conexão: não desvia para o endereço de reserva.
    expect(ehFalhaDeConexao(e)).toBe(false);
  });
  it("consulta crua: P2010 com o código 42703 do Postgres", () => {
    expect(ehColunaQueFalta(Object.assign(new Error("Raw query failed. Code: `42703`."), { code: "P2010", meta: { code: "42703" } }))).toBe(true);
    expect(ehColunaQueFalta(Object.assign(new Error("Raw query failed. Code: `42P01`."), { code: "P2010", meta: { code: "42P01" } }))).toBe(false);
  });
  it("o resto sobe como veio: conexão, dado repetido, trava, lixo", () => {
    expect(ehColunaQueFalta(Object.assign(new Error("Can't reach database server"), { name: "PrismaClientInitializationError" }))).toBe(false);
    expect(ehColunaQueFalta(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }))).toBe(false);
    expect(ehColunaQueFalta(Object.assign(new Error("The table `public.Usuario` does not exist in the current database."), { code: "P2021" }))).toBe(false);
    expect(ehColunaQueFalta(null)).toBe(false);
    expect(ehColunaQueFalta("column does not exist")).toBe(false);
    expect(ehColunaQueFalta(42)).toBe(false);
  });
});

describe("o que falta, comparando o banco com o schema", () => {
  it("banco completo: nada a fazer", () => {
    expect(oQueFalta(bancoCompleto())).toEqual({ comandos: [], semComoCriar: [] });
  });

  it("o Neon sem as colunas de 22/09: UM comando para a tabela, com a definição do schema", () => {
    const r = oQueFalta(bancoCompleto(["Cliente.naoPerturbe", "Cliente.naoPerturbeEm", "Cliente.naoPerturbeMotivo"]));
    expect(r.semComoCriar).toEqual([]);
    expect(r.comandos).toHaveLength(1);
    expect(r.comandos[0].tabela).toBe("Cliente");
    expect(r.comandos[0].colunas).toEqual(["naoPerturbe", "naoPerturbeEm", "naoPerturbeMotivo"]);
    expect(r.comandos[0].sql).toBe(
      'ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "naoPerturbe" BOOLEAN NOT NULL DEFAULT false, ' +
      'ADD COLUMN IF NOT EXISTS "naoPerturbeEm" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "naoPerturbeMotivo" TEXT',
    );
  });

  it("faltando em duas tabelas: um comando por tabela", () => {
    const r = oQueFalta(bancoCompleto(["Cliente.naoPerturbe", "Visita.cidade"]));
    expect(r.comandos.map((c) => c.tabela).sort()).toEqual(["Cliente", "Visita"]);
  });

  it("obrigatória sem padrão: não entra no comando, fica dita", () => {
    const r = oQueFalta(bancoCompleto(["Cliente.atualizadoEm", "Cliente.naoPerturbe"]));
    expect(r.semComoCriar).toEqual(["Cliente.atualizadoEm"]);
    expect(r.comandos[0].colunas).toEqual(["naoPerturbe"]);
    expect(r.comandos[0].sql).not.toContain("atualizadoEm");
  });

  it("tabela inteira faltando não é daqui (criar só ela deixaria as chaves estrangeiras para trás)", () => {
    const r = oQueFalta(bancoCompleto([], ["Cliente"]));
    expect(r.comandos).toEqual([]);
    expect(r.semComoCriar).toEqual([]);
  });

  it("coluna que a migração preenche quando nasce: fica para a migração", () => {
    const r = oQueFalta(bancoCompleto(["Visita.status", "Visita.cidade"]));
    expect(r.semComoCriar).toEqual(["Visita.status"]);
    expect(r.comandos[0].colunas).toEqual(["cidade"]);
  });

  // A migração que preenche as linhas antigas "só quando a coluna nasce" sabe
  // disso perguntando ao banco se a coluna existe. Criada antes pelo
  // conserto, o preenchimento nunca rodaria. Migração nova nesse formato
  // falha aqui até a coluna entrar em NASCE_PELA_MIGRACAO.
  it("toda coluna que a migração usa para saber se é a 1ª vez está em NASCE_PELA_MIGRACAO", () => {
    const migracoes = readFileSync(join(__dirname, "../src/lib/migrations.ts"), "utf8");
    const perguntas = [...migracoes.matchAll(/table_name = '(\w+)' AND column_name = '(\w+)'/g)].map((m) => `${m[1]}.${m[2]}`);
    expect(perguntas.length).toBeGreaterThan(0);
    for (const c of perguntas) expect(NASCE_PELA_MIGRACAO).toContain(c);
    expect(migracoes).not.toMatch(/column_name\s*=\s*'\w+'\s+AND\s+table_name/);
  });

  it("o que o banco tem a mais (as sobras do multiusuário no Neon) não atrapalha", () => {
    const r = oQueFalta([...bancoCompleto(), { tabela: "Cliente", coluna: "vendedorId" }, { tabela: "Usuario", coluna: "id" }]);
    expect(r).toEqual({ comandos: [], semComoCriar: [] });
  });
});

describe("o comando vai com espera curta pela trava da tabela", () => {
  it("um comando só (o pooler do Neon não guarda SET entre comandos), com 4 s de espera", () => {
    const alter = `ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'potencial'`;
    const sql = comEsperaCurta(alter);
    expect(sql).toMatch(/^DO \$crm\$ BEGIN SET LOCAL lock_timeout = '4s'; EXECUTE \$alter\$/);
    // As aspas simples do valor padrão passam intactas (vai entre $alter$).
    expect(sql).toContain(`$alter$${alter}$alter$`);
  });
});

/** Banco falso: conta as consultas ao catálogo e guarda os comandos. */
function bancoFalso(noBanco: ColunaNoBanco[], opcoes: { falhar?: Error; demora?: number } = {}) {
  const chamadas = { catalogo: 0, comandos: [] as string[] };
  const cliente: ExecutorCru = {
    async $queryRawUnsafe<T>(sql: string) {
      expect(sql).toBe(SQL_COLUNAS_DO_BANCO);
      chamadas.catalogo += 1;
      if (opcoes.demora) await new Promise((r) => setTimeout(r, opcoes.demora));
      if (opcoes.falhar) throw opcoes.falhar;
      return noBanco as T;
    },
    async $executeRawUnsafe(sql: string) {
      chamadas.comandos.push(sql);
      return 0;
    },
  };
  return { cliente, chamadas };
}

describe("completar o banco", () => {
  it("roda o comando de cada tabela, com espera curta, e diz o que criou", async () => {
    const { cliente, chamadas } = bancoFalso(bancoCompleto(["Cliente.naoPerturbe", "Visita.cidade", "Cliente.atualizadoEm"]));
    const r = await completarColunas(cliente);
    expect(r.criadas.sort()).toEqual(["Cliente.naoPerturbe", "Visita.cidade"]);
    expect(r.semComoCriar).toEqual(["Cliente.atualizadoEm"]);
    expect(chamadas.comandos).toHaveLength(2);
    for (const c of chamadas.comandos) expect(c).toMatch(/^DO \$crm\$ BEGIN SET LOCAL lock_timeout = '4s'; EXECUTE \$alter\$ALTER TABLE/);
  });

  it("banco completo: só a consulta ao catálogo, nenhum ALTER", async () => {
    const { cliente, chamadas } = bancoFalso(bancoCompleto());
    expect(await completarColunas(cliente)).toEqual({ criadas: [], semComoCriar: [] });
    expect(chamadas.comandos).toEqual([]);
  });
});

describe("o freio do conserto", () => {
  it("dez consultas caindo juntas esperam o MESMO conserto", async () => {
    const avisar = vi.fn();
    const consertar = criarConsertoDeColunas({ avisar });
    const { cliente, chamadas } = bancoFalso(bancoCompleto(["Cliente.naoPerturbe"]), { demora: 20 });
    const r = await Promise.all(Array.from({ length: 10 }, () => consertar(cliente)));
    expect(r).toEqual(Array(10).fill(true));
    expect(chamadas.catalogo).toBe(1);
    expect(chamadas.comandos).toHaveLength(1);
    expect(avisar).toHaveBeenCalledTimes(1);
    expect(avisar.mock.calls[0][0]).toContain("Cliente.naoPerturbe");
  });

  it("depois de um conserto, 1 minuto sem outro — quem cair nesse minuto só repete a consulta", async () => {
    let agora = 1_000_000;
    const consertar = criarConsertoDeColunas({ agora: () => agora, avisar: () => {} });
    const { cliente, chamadas } = bancoFalso(bancoCompleto());
    expect(await consertar(cliente)).toBe(true);
    agora += JANELA_ENTRE_CONSERTOS_MS - 1;
    expect(await consertar(cliente)).toBe(true); // repete a consulta, sem ir ao catálogo
    expect(chamadas.catalogo).toBe(1);
    agora += 2;
    expect(await consertar(cliente)).toBe(true);
    expect(chamadas.catalogo).toBe(2);
  });

  it("conserto que falhou: não repete a consulta, diz o motivo, e também espera o minuto", async () => {
    let agora = 5_000_000;
    const avisar = vi.fn();
    const consertar = criarConsertoDeColunas({ agora: () => agora, avisar });
    const { cliente, chamadas } = bancoFalso([], { falhar: new Error("canceling statement\n  due to lock timeout") });
    expect(await consertar(cliente)).toBe(false);
    expect(avisar.mock.calls[0][0]).toBe("[banco] não consegui criar a coluna que falta: canceling statement due to lock timeout");
    agora += 1000;
    expect(await consertar(cliente)).toBe(false);
    expect(chamadas.catalogo).toBe(1); // cem cliques num banco travado = UMA ida ao catálogo por minuto
  });

  it("coluna sem como criar: avisa qual, sem repetir aviso a cada clique", async () => {
    let agora = 9_000_000;
    const avisar = vi.fn();
    const consertar = criarConsertoDeColunas({ agora: () => agora, avisar });
    const { cliente } = bancoFalso(bancoCompleto(["Cliente.atualizadoEm"]));
    await consertar(cliente);
    agora += 10;
    await consertar(cliente);
    expect(avisar).toHaveBeenCalledTimes(1);
    expect(avisar.mock.calls[0][0]).toContain("Cliente.atualizadoEm");
  });
});
