import { describe, it, expect } from "vitest";
import {
  papelDaColuna, papelPorTitulo, probabilidadeDaColuna, criarCategorizadorColunas,
  valorPonderado, rotuloMotivoPerda, normalizarEstagio,
} from "@/lib/pipeline";

describe("papel das colunas do funil", () => {
  it("usa o papel gravado, ignorando o título", () => {
    expect(papelDaColuna({ titulo: "Qualquer nome", papel: "faturado" })).toBe("faturado");
    expect(papelDaColuna({ titulo: "FATURADO", papel: "em_negociacao" })).toBe("em_negociacao");
  });

  it("cai no reconhecimento por palavra quando não há papel", () => {
    expect(papelPorTitulo("Venda perdida")).toBe("perdida");
    expect(papelPorTitulo("FATURADO")).toBe("faturado");
    expect(papelPorTitulo("Vendas Confirmadas")).toBe("confirmada");
    expect(papelPorTitulo("Proposta no BCNH")).toBe("banco");
    expect(papelPorTitulo("Primeiro contato")).toBe("em_negociacao");
    expect(papelDaColuna({ titulo: "Proposta no banco", papel: null })).toBe("banco");
  });

  it("ignora papel inválido", () => {
    expect(papelDaColuna({ titulo: "FATURADO", papel: "xyz" })).toBe("faturado");
  });

  it("probabilidade: gravada, limitada a 0-100, ou padrão do papel", () => {
    expect(probabilidadeDaColuna({ titulo: "x", papel: "banco", probabilidade: 65 })).toBe(65);
    expect(probabilidadeDaColuna({ titulo: "x", papel: "banco", probabilidade: 140 })).toBe(100);
    expect(probabilidadeDaColuna({ titulo: "x", papel: "faturado" })).toBe(100);
    expect(probabilidadeDaColuna({ titulo: "x", papel: "perdida" })).toBe(0);
  });
});

describe("categorizador de colunas", () => {
  const colunas = [
    { titulo: "Primeiro contato", papel: "em_negociacao" },
    { titulo: "Análise de crédito", papel: "banco" },
    { titulo: "Fechado", papel: "faturado" },
    { titulo: "Não rolou", papel: "perdida" },
  ];
  const cat = criarCategorizadorColunas(colunas);

  it("classifica pelo papel mesmo com títulos renomeados", () => {
    expect(cat("Primeiro contato")).toBe("em_negociacao");
    expect(cat("Análise de crédito")).toBe("banco");
    expect(cat("Fechado")).toBe("confirmada");
    expect(cat("Não rolou")).toBe("perdida");
  });

  it("estágio órfão (coluna excluída) vira 'outro', exceto palavras terminais", () => {
    expect(cat("Coluna antiga")).toBe("outro");
    expect(cat("FATURADO")).toBe("confirmada");
    expect(cat("Venda perdida")).toBe("perdida");
  });
});

describe("valor ponderado", () => {
  const colunas = [
    { titulo: "A", papel: "em_negociacao", probabilidade: 20 },
    { titulo: "B", papel: "banco", probabilidade: 70 },
    { titulo: "F", papel: "faturado", probabilidade: 100 },
  ];
  it("soma valor × probabilidade só das abertas com coluna conhecida", () => {
    const negs = [
      { estagio: "A", status: "aberta", valor: 100_000 },
      { estagio: "B", status: "aberta", valor: 200_000 },
      { estagio: "F", status: "ganha", valor: 900_000 },
      { estagio: "Z", status: "aberta", valor: 500_000 },
      { estagio: "A", status: "aberta", valor: null },
    ];
    expect(valorPonderado(negs, colunas)).toBe(20_000 + 140_000);
  });
});

describe("motivo de perda", () => {
  it("traduz código e mantém a nota", () => {
    expect(rotuloMotivoPerda("concorrente")).toBe("Comprou do concorrente");
    expect(rotuloMotivoPerda("preco: pediu 10% a menos")).toBe("Preço / condição · pediu 10% a menos");
    expect(rotuloMotivoPerda("texto livre antigo")).toBe("texto livre antigo");
    expect(rotuloMotivoPerda(null)).toBe("Não informado");
  });
});

describe("estágios legados", () => {
  it("normaliza ids antigos", () => {
    expect(normalizarEstagio("novo")).toBe("primeiro_contato");
    expect(normalizarEstagio("negociacao")).toBe("proposta_bcnh");
    expect(normalizarEstagio("Primeiro contato")).toBe("Primeiro contato");
  });
});
