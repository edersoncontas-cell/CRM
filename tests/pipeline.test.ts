import { describe, it, expect } from "vitest";
import {
  papelDaColuna, papelPorTitulo, probabilidadeDaColuna, criarCategorizadorColunas,
  valorPonderado, rotuloMotivoPerda, normalizarEstagio,
  FUNIL_CANONICO, ehFunilAberto, corDaColuna, VAR_COR_PAPEL,
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

// ── O FUNIL NOVO ───────────────────────────────────────────────────────────
//
// "no lugar da coluna EM NEGOCIAÇÃO será OPORTUNIDADE (...) a coluna PROPOSTA
//  no lugar de EM BANCO (...) depois a coluna NEGOCIAÇÃO (...) a coluna
//  faturados você vai deixar intacta, a venda perdida (...) em uma sessão
//  separada"
//
// O risco aqui é CONTAR VENDA QUE NÃO ACONTECEU. Crédito aprovado não é
// máquina faturada: se a coluna NEGOCIAÇÃO marcasse "ganha", como a antiga
// "Vendas Confirmadas" fazia, o negócio sairia das abertas, sumiria da
// previsão do funil e entraria no Dashboard como vendido.

describe("o funil canônico", () => {
  it("são quatro colunas no quadro, nesta ordem", () => {
    const quadro = FUNIL_CANONICO.filter((c) => c.noQuadro);
    expect(quadro.map((c) => c.titulo)).toEqual(["OPORTUNIDADE", "PROPOSTA", "NEGOCIAÇÃO", "FATURADO"]);
  });

  it("a venda perdida existe, mas fora do quadro", () => {
    const perdida = FUNIL_CANONICO.find((c) => c.papel === "perdida");
    expect(perdida).toBeDefined();
    expect(perdida!.noQuadro).toBe(false);
  });

  it("a probabilidade sobe do começo ao fim do funil", () => {
    const probs = FUNIL_CANONICO.filter((c) => c.noQuadro).map((c) => c.probabilidade);
    expect(probs).toEqual([...probs].sort((a, b) => a - b));
    expect(probs[probs.length - 1]).toBe(100);
  });
});

describe("NEGOCIAÇÃO é fase aberta, não venda", () => {
  const colunas = FUNIL_CANONICO.map((c) => ({ titulo: c.titulo, papel: c.papel, probabilidade: c.probabilidade }));
  const cat = criarCategorizadorColunas(colunas);

  it("crédito aprovado NÃO conta como vendido", () => {
    expect(cat("NEGOCIAÇÃO")).toBe("negociacao");
    expect(cat("NEGOCIAÇÃO")).not.toBe("confirmada");
  });

  it("só o FATURADO é venda", () => {
    expect(cat("FATURADO")).toBe("confirmada");
  });

  it("as três primeiras colunas são o funil em pé", () => {
    expect(ehFunilAberto(cat("OPORTUNIDADE"))).toBe(true);
    expect(ehFunilAberto(cat("PROPOSTA"))).toBe(true);
    expect(ehFunilAberto(cat("NEGOCIAÇÃO"))).toBe(true);
  });

  it("faturado e perdida não são funil em pé", () => {
    expect(ehFunilAberto(cat("FATURADO"))).toBe(false);
    expect(ehFunilAberto(cat("VENDA PERDIDA"))).toBe(false);
  });

  it("a NEGOCIAÇÃO entra na previsão ponderada — é dinheiro ainda de pé", () => {
    const previsao = valorPonderado(
      [{ estagio: "NEGOCIAÇÃO", status: "aberta", valor: 600_000 }],
      colunas
    );
    expect(previsao).toBe(480_000); // 600k × 80%
  });
});

describe("a cor vem do papel, nunca do título", () => {
  it("renomear a coluna não muda a cor de lugar", () => {
    expect(corDaColuna({ titulo: "OPORTUNIDADE", papel: "em_negociacao" }))
      .toBe(corDaColuna({ titulo: "Nome que o Edy inventar", papel: "em_negociacao" }));
  });

  it("cada papel tem a sua variável, e nenhuma se repete", () => {
    const vars = Object.values(VAR_COR_PAPEL);
    expect(new Set(vars).size).toBe(vars.length);
    expect(corDaColuna({ titulo: "FATURADO", papel: "faturado" })).toBe("var(--funil-faturado)");
  });
});
