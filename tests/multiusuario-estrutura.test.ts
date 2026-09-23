// A estrutura do multiusuário — o que derrubou o CRM dele.
//
// O schema passou a pedir a coluna vendedorId em toda consulta, e o banco só
// ganharia a coluna quando a manutenção rodasse. A manutenção roda DENTRO de
// uma requisição, junto com as consultas da página: quem chegasse primeiro
// decidia. Chegou a consulta, a tela caiu.
//
// O que se prova aqui é o desenho do conserto: a estrutura é idempotente,
// segura com duas lambdas ao mesmo tempo, e a checagem é barata (um SELECT,
// sem escrever nada) para poder ficar no caminho de toda consulta.

import { describe, it, expect } from "vitest";
import {
  TABELAS_DO_VENDEDOR,
  estruturaJaExiste,
  garantirEstruturaMultiusuario,
  type ExecutorCru,
} from "@/lib/multiusuario-estrutura";

function bancoFalso(colunasExistentes: number) {
  const sql: string[] = [];
  const cliente: ExecutorCru = {
    async $executeRawUnsafe(texto: string) { sql.push(texto); return 0; },
    async $queryRawUnsafe<T>() { return [{ n: colunasExistentes }] as T; },
  };
  return { cliente, sql };
}

describe("checagem da estrutura", () => {
  it("banco novo (nenhuma coluna) — precisa criar", async () => {
    const { cliente } = bancoFalso(0);
    expect(await estruturaJaExiste(cliente)).toBe(false);
  });

  it("estrutura pela metade também precisa criar — 7 das 8 não vale", async () => {
    const { cliente } = bancoFalso(TABELAS_DO_VENDEDOR.length - 1);
    expect(await estruturaJaExiste(cliente)).toBe(false);
  });

  it("as 8 no lugar — não mexe mais", async () => {
    const { cliente } = bancoFalso(TABELAS_DO_VENDEDOR.length);
    expect(await estruturaJaExiste(cliente)).toBe(true);
  });

  it("a checagem NÃO escreve nada — ela fica no caminho de toda consulta", async () => {
    const { cliente, sql } = bancoFalso(8);
    await estruturaJaExiste(cliente);
    expect(sql).toEqual([]);
  });
});

describe("criação da estrutura", () => {
  it("cobre as 8 tabelas: coluna e índice em cada uma, mais a tabela Usuario", async () => {
    const { cliente, sql } = bancoFalso(0);
    await garantirEstruturaMultiusuario(cliente);
    const tudo = sql.join("\n");
    expect(tudo).toContain('CREATE TABLE IF NOT EXISTS "Usuario"');
    for (const t of TABELAS_DO_VENDEDOR) {
      expect(tudo).toContain(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "vendedorId"`);
      expect(tudo).toContain(`CREATE INDEX IF NOT EXISTS "${t}_vendedorId_idx"`);
    }
  });

  // Duas lambdas subindo ao mesmo tempo no deploy é o caso normal, não a
  // exceção. Sem IF NOT EXISTS em TODO comando, uma das duas estoura.
  it("todo comando é IF NOT EXISTS — duas lambdas juntas não se atrapalham", async () => {
    const { cliente, sql } = bancoFalso(0);
    await garantirEstruturaMultiusuario(cliente);
    expect(sql.length).toBeGreaterThan(0);
    for (const comando of sql) expect(comando).toMatch(/IF NOT EXISTS/);
  });

  it("rodar duas vezes dá exatamente os mesmos comandos", async () => {
    const a = bancoFalso(0); await garantirEstruturaMultiusuario(a.cliente);
    const b = bancoFalso(0); await garantirEstruturaMultiusuario(b.cliente);
    expect(a.sql).toEqual(b.sql);
  });
});
