// A estrutura gerada do schema — o que deixa o CRM nascer num banco vazio.
//
// Existe porque o banco de produção ficou suspenso por cota e a saída grátis
// no mesmo dia era um banco novo em outro provedor — vazio. O que se prova
// aqui é que o arquivo gerado continua íntegro: todas as tabelas que o CRM
// usa estão nele, na ordem que o Postgres aceita (tabela antes do índice,
// índice antes da chave estrangeira), e nenhum comando vem com ';' sobrando
// (o Prisma executa um comando por vez e recusa dois no mesmo texto).

import { describe, it, expect } from "vitest";
import { DDL_DO_ZERO } from "@/lib/banco-do-zero-ddl";

const tabelas = DDL_DO_ZERO.filter((c) => c.startsWith("CREATE TABLE"));
const nomeDaTabela = (c: string) => /CREATE TABLE "([^"]+)"/.exec(c)?.[1];

describe("estrutura do zero", () => {
  it("tem as tabelas que o CRM não vive sem", () => {
    const nomes = new Set(tabelas.map(nomeDaTabela));
    for (const t of ["Configuracao", "Cliente", "Negociacao", "Visita", "WhatsAppConversation", "WhatsAppMessage",
      "Municipio", "Maquina", "EnvioProgramado", "TarefaKanban", "Evento", "ZeusEvent"]) {
      expect(nomes.has(t), `faltou ${t}`).toBe(true);
    }
    expect(tabelas.length).toBeGreaterThanOrEqual(40);
  });

  it("um comando por item — nenhum ';' no meio (o Prisma recusa dois comandos juntos)", () => {
    for (const c of DDL_DO_ZERO) expect(c.replace(/'[^']*'/g, "")).not.toMatch(/;/);
  });

  it("ordem que o Postgres aceita: toda tabela antes do 1º índice, todo índice antes da 1ª chave estrangeira", () => {
    const ultimaTabela = DDL_DO_ZERO.map((c) => c.startsWith("CREATE TABLE")).lastIndexOf(true);
    const primeiroIndice = DDL_DO_ZERO.findIndex((c) => /^CREATE (UNIQUE )?INDEX/.test(c));
    const primeiraFk = DDL_DO_ZERO.findIndex((c) => c.startsWith("ALTER TABLE") && c.includes("FOREIGN KEY"));
    expect(primeiroIndice).toBeGreaterThan(ultimaTabela);
    expect(primeiraFk).toBeGreaterThan(primeiroIndice);
  });

  it("toda chave estrangeira aponta para tabela que existe no mesmo arquivo", () => {
    const nomes = new Set(tabelas.map(nomeDaTabela));
    for (const c of DDL_DO_ZERO) {
      const m = /REFERENCES "([^"]+)"/.exec(c);
      if (m) expect(nomes.has(m[1]), `FK para ${m[1]} sem tabela`).toBe(true);
    }
  });
});
