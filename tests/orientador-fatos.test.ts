// Dois defeitos reais, reportados com print da tela:
//
// 1) O vendedor escreveu no campo "O que o Orientador precisa saber" que tinha
//    fechado em 610 mil e que ia entrar com o financiamento no banco dele. O
//    card "Negociação" continuou dizendo "modelo ainda não definido" e "valor
//    ainda não negociado", e mostrou "Pagamento: outro" com o símbolo de
//    confirmado. Causa: o card lê a tabela Negociacao, alimentada por uma
//    extração que só olha o WhatsApp e nunca viu a nota.
//
// 2) Um cliente de Guaçuí apareceu como sendo de Recife. Causa: o contrato da
//    IA aceitava qualquer texto como cidade e o CRM criava o município do jeito
//    que viesse — sem conferir que o CRM inteiro é do Espírito Santo.
//
// Aqui ficam as regras que impedem os dois.

import { describe, it, expect } from "vitest";
import {
  normalizarPagamento, municipioDoES, municipioForaDoES, normalizarModelo,
  normalizarMarca, normalizarValor, normalizarFatos, mudancasDaNegociacao, FATOS_VAZIOS,
} from "@/lib/orientador-fatos";

describe("forma de pagamento", () => {
  it("reconhece as quatro formas, escritas como o vendedor escreve", () => {
    expect(normalizarPagamento("avista")).toBe("avista");
    expect(normalizarPagamento("À vista")).toBe("avista");
    expect(normalizarPagamento("pix")).toBe("avista");
    expect(normalizarPagamento("financiamento")).toBe("financiamento");
    expect(normalizarPagamento("Financiado")).toBe("financiamento");
    expect(normalizarPagamento("FINAME")).toBe("financiamento");
    expect(normalizarPagamento("consórcio")).toBe("consorcio");
    expect(normalizarPagamento("crd_pme")).toBe("crd_pme");
    expect(normalizarPagamento("parcelado pela casa")).toBe("crd_pme");
  });

  it('"outro" não é forma de pagamento — era o que a tela mostrava', () => {
    expect(normalizarPagamento("outro")).toBe(null);
    expect(normalizarPagamento("Outros")).toBe(null);
    expect(normalizarPagamento("a definir")).toBe(null);
    expect(normalizarPagamento("pesquisa_preco")).toBe(null);
    expect(normalizarPagamento("interesse_real")).toBe(null);
    expect(normalizarPagamento("")).toBe(null);
    expect(normalizarPagamento(null)).toBe(null);
  });
});

describe("cidade do cliente", () => {
  it("aceita município do ES e devolve o nome como o CRM escreve", () => {
    expect(municipioDoES("guacui")).toBe("Guaçuí");
    expect(municipioDoES("GUAÇUÍ")).toBe("Guaçuí");
    expect(municipioDoES("Guaçuí - ES")).toBe("Guaçuí");
    expect(municipioDoES("cachoeiro de itapemirim")).toBe("Cachoeiro de Itapemirim");
  });

  it("Recife não entra — foi exatamente o erro reportado", () => {
    expect(municipioDoES("Recife")).toBe(null);
    expect(municipioForaDoES("Recife")).toBe(true);
    expect(municipioForaDoES("Guaçuí")).toBe(false);
  });

  it("cidade de outro estado e nome inventado são recusados", () => {
    expect(municipioDoES("São Paulo")).toBe(null);
    expect(municipioDoES("Belo Horizonte")).toBe(null);
    expect(municipioDoES("Cidade Que Não Existe")).toBe(null);
    expect(municipioDoES("")).toBe(null);
    expect(municipioDoES(null)).toBe(null);
  });
});

describe("modelo da máquina", () => {
  it("modelo de verdade passa", () => {
    expect(normalizarModelo("B110")).toBe("B110");
    expect(normalizarModelo("E145C EVO")).toBe("E145C EVO");
    expect(normalizarModelo("CA25 D")).toBe("CA25 D");
  });

  it("categoria solta não é modelo — senão o card mentiria que está definido", () => {
    expect(normalizarModelo("retroescavadeira")).toBe(null);
    expect(normalizarModelo("uma máquina")).toBe(null);
    expect(normalizarModelo("rolo compactador")).toBe(null);
    expect(normalizarModelo("a definir")).toBe(null);
    expect(normalizarModelo("")).toBe(null);
  });
});

describe("marca", () => {
  it("normaliza as duas marcas da casa", () => {
    expect(normalizarMarca("new holland")).toBe("New Holland");
    expect(normalizarMarca("NewHolland")).toBe("New Holland");
    expect(normalizarMarca("DYNAPAC")).toBe("Dynapac");
  });
  it("marca de fora não entra", () => {
    expect(normalizarMarca("Caterpillar")).toBe(null);
    expect(normalizarMarca("")).toBe(null);
  });
});

describe("valor negociado", () => {
  it("lê o jeito que o vendedor escreve na nota", () => {
    expect(normalizarValor(610000)).toBe(610000);
    expect(normalizarValor("610 mil")).toBe(610000);
    expect(normalizarValor("R$ 610.000")).toBe(610000);
    expect(normalizarValor("610.000,00")).toBe(610000);
    expect(normalizarValor("1,2 milhao")).toBe(1200000);
  });

  it("número solto da conversa não vira preço de máquina", () => {
    expect(normalizarValor(30)).toBe(null);        // 30% de entrada
    expect(normalizarValor(48)).toBe(null);         // 48 parcelas
    expect(normalizarValor(900)).toBe(null);        // horas de uso
    expect(normalizarValor(999_999_999_999)).toBe(null);
    expect(normalizarValor("qualquer coisa")).toBe(null);
    expect(normalizarValor(null)).toBe(null);
  });
});

describe("bloco de fatos devolvido pelo Orientador", () => {
  it("o caso do print: 610 mil + financiamento pelo banco + B110 em Guaçuí", () => {
    const f = normalizarFatos({
      marca: "New Holland", maquinaModelo: "B110", valor: 610000,
      condicaoPagamento: "financiamento", municipio: "Guaçuí",
    });
    expect(f).toEqual({
      marca: "New Holland", maquinaModelo: "B110", valor: 610000,
      condicaoPagamento: "financiamento", municipio: "Guaçuí",
    });
  });

  it("lixo vira null em vez de virar dado na ficha do cliente", () => {
    expect(normalizarFatos({ marca: "Caterpillar", maquinaModelo: "uma retro", valor: 12, condicaoPagamento: "outro", municipio: "Recife" }))
      .toEqual(FATOS_VAZIOS);
  });

  it("resposta sem o bloco não quebra", () => {
    expect(normalizarFatos(undefined)).toEqual(FATOS_VAZIOS);
    expect(normalizarFatos("texto")).toEqual(FATOS_VAZIOS);
  });
});

describe("o que gravar na negociação", () => {
  const vazia = { marca: null, maquinaModelo: null, valor: null, tipoPagamento: null };
  const fatos = { marca: "New Holland", maquinaModelo: "B110", valor: 610000, condicaoPagamento: "financiamento" as const, municipio: null };

  it("campo vazio é sempre preenchido, com ou sem nota", () => {
    expect(mudancasDaNegociacao(vazia, fatos, false)).toEqual({
      marca: "New Holland", maquinaModelo: "B110", valor: 610000,
      tipoPagamento: "financiamento", condicaoPagamento: "",
    });
  });

  it("SEM nota, não mexe no que já está preenchido (pode ter sido digitado por uma pessoa)", () => {
    const cheia = { marca: "Dynapac", maquinaModelo: "CA25 D", valor: 400000, tipoPagamento: "avista" };
    expect(mudancasDaNegociacao(cheia, fatos, false)).toEqual({});
  });

  it("COM nota, o que o vendedor escreveu ganha — ele esteve lá", () => {
    const cheia = { marca: "Dynapac", maquinaModelo: "CA25 D", valor: 400000, tipoPagamento: "avista" };
    expect(mudancasDaNegociacao(cheia, fatos, true)).toEqual({
      marca: "New Holland", maquinaModelo: "B110", valor: 610000,
      tipoPagamento: "financiamento", condicaoPagamento: "",
    });
  });

  it('"outro" gravado no banco conta como vazio e é substituído sem precisar de nota', () => {
    const comOutro = { marca: null, maquinaModelo: null, valor: null, tipoPagamento: "outro" };
    expect(mudancasDaNegociacao(comOutro, fatos, false).tipoPagamento).toBe("financiamento");
  });

  it("valor zero conta como vazio", () => {
    const zerada = { marca: null, maquinaModelo: null, valor: 0, tipoPagamento: null };
    expect(mudancasDaNegociacao(zerada, fatos, false).valor).toBe(610000);
  });

  it("fatos vazios não geram escrita nenhuma", () => {
    const cheia = { marca: "Dynapac", maquinaModelo: "CA25 D", valor: 400000, tipoPagamento: "avista" };
    expect(mudancasDaNegociacao(cheia, FATOS_VAZIOS, true)).toEqual({});
  });

  it("valor igual ao que já está não gera escrita à toa", () => {
    const igual = { marca: "New Holland", maquinaModelo: "B110", valor: 610000, tipoPagamento: "financiamento" };
    expect(mudancasDaNegociacao(igual, fatos, true)).toEqual({});
  });
});
