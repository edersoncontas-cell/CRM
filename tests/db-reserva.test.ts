// O desvio para o endereço direto do Neon — a parte pura dele.
//
// Ontem o CRM ficou um dia fora do ar com "Can't reach database server at
// ep-...-pooler". O pooler e o endereço direto são caminhos diferentes; um pode
// cair com o outro de pé. O que se prova aqui é o critério que decide quando
// desviar: SÓ falha de conexão. Erro de consulta (coluna errada, dado inválido)
// tem que subir igual — desviar nesses casos esconderia defeito de código.

import { describe, it, expect } from "vitest";
import { ehFalhaDeConexao } from "@/lib/db";

describe("o que conta como falha de conexão", () => {
  it("o erro de ontem, ao pé da letra", () => {
    const e = Object.assign(new Error("Invalid `prisma.$queryRawUnsafe()` invocation: Can't reach database server at `ep-gentle-truth-acybwmdr-pooler.sa-east-1.aws.neon.tech:5432`"), { name: "PrismaClientInitializationError" });
    expect(ehFalhaDeConexao(e)).toBe(true);
  });

  it("pelos códigos do Prisma: P1001 (não alcança), P1002 (tempo), P1017 (servidor fechou)", () => {
    for (const code of ["P1001", "P1002", "P1017"]) {
      expect(ehFalhaDeConexao(Object.assign(new Error("x"), { code }))).toBe(true);
      expect(ehFalhaDeConexao(Object.assign(new Error("x"), { errorCode: code }))).toBe(true);
    }
  });

  it("conexão recusada / derrubada / tempo esgotado, pela mensagem", () => {
    expect(ehFalhaDeConexao(new Error("connect ECONNREFUSED: connection refused"))).toBe(true);
    expect(ehFalhaDeConexao(new Error("Connection reset by peer"))).toBe(true);
    expect(ehFalhaDeConexao(new Error("Socket timed out"))).toBe(true);
  });

  // O lado que NÃO pode desviar: erro de consulta é defeito de código e tem
  // que aparecer, não ser engolido por uma tentativa em outro endereço.
  it("erro de consulta NÃO é falha de conexão — sobe igual", () => {
    expect(ehFalhaDeConexao(Object.assign(new Error("The column `Negociacao.vendedorId` does not exist"), { code: "P2022" }))).toBe(false);
    expect(ehFalhaDeConexao(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }))).toBe(false);
    expect(ehFalhaDeConexao(new Error("Invalid `prisma.cliente.findMany()` invocation: Unknown argument"))).toBe(false);
  });

  it("lixo não derruba o critério", () => {
    expect(ehFalhaDeConexao(null)).toBe(false);
    expect(ehFalhaDeConexao(undefined)).toBe(false);
    expect(ehFalhaDeConexao("texto")).toBe(false);
    expect(ehFalhaDeConexao(42)).toBe(false);
  });
});
