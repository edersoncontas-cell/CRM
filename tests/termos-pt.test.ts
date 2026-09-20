// "e outra excavadora? erro grotesco de português" / "Sempre será escavadeira"
//
// Em português do Brasil é ESCAVADEIRA. "Excavadora" é espanhol, e o modelo
// escorrega nisso porque o material técnico de máquina pesada na internet é
// majoritariamente em espanhol e em inglês. Na tela de quem vende máquina há
// anos, um erro desses queima a confiança no painel inteiro — então a correção
// é feita por código, onde é determinística, e não só pedida no prompt.

import { describe, it, expect } from "vitest";
import { corrigirTermos, corrigirTermosNaLista } from "@/lib/zeus/termos-pt";

describe("sempre será escavadeira", () => {
  it("corrige todas as formas erradas", () => {
    expect(corrigirTermos("o cliente quer uma excavadora")).toBe("o cliente quer uma escavadeira");
    expect(corrigirTermos("duas excavadoras")).toBe("duas escavadeiras");
    expect(corrigirTermos("uma escavadora nova")).toBe("uma escavadeira nova");
    expect(corrigirTermos("excavadeira")).toBe("escavadeira");
  });

  it("o que já está certo não é tocado", () => {
    expect(corrigirTermos("o cliente quer uma escavadeira")).toBe("o cliente quer uma escavadeira");
    expect(corrigirTermos("duas escavadeiras de esteira")).toBe("duas escavadeiras de esteira");
  });

  it("retroescavadeira também", () => {
    expect(corrigirTermos("retroexcavadora")).toBe("retroescavadeira");
    expect(corrigirTermos("retroescavadora B110")).toBe("retroescavadeira B110");
    expect(corrigirTermos("retroescavadeira B110")).toBe("retroescavadeira B110");
  });

  it("mantém a maiúscula do começo da frase", () => {
    expect(corrigirTermos("Excavadora E145C na mesa.")).toBe("Escavadeira E145C na mesa.");
    expect(corrigirTermos("EXCAVADORA")).toBe("Escavadeira");
  });
});

describe("as outras máquinas", () => {
  it("pá carregadeira", () => {
    expect(corrigirTermos("uma cargadora")).toBe("uma pá carregadeira");
    expect(corrigirTermos("duas cargadoras")).toBe("duas pás carregadeiras");
  });

  it("rolo compactador", () => {
    expect(corrigirTermos("a compactadora CA25")).toBe("a rolo compactador CA25");
  });
});

describe("palavras de espanhol em condição de pagamento", () => {
  it("viram o vocabulário da casa", () => {
    expect(corrigirTermos("com enganche de 30%")).toBe("com entrada de 30%");
    expect(corrigirTermos("em 48 cuotas")).toBe("em 48 parcelas");
    expect(corrigirTermos("uma cuota por mês")).toBe("uma parcela por mês");
    expect(corrigirTermos("financiacion pelo banco")).toBe("financiamento pelo banco");
  });
});

describe("não estraga texto normal", () => {
  it("texto sem termo errado sai idêntico", () => {
    const t = "Ligar hoje até 17h e confirmar a visita de quinta às 14h em Guaçuí.";
    expect(corrigirTermos(t)).toBe(t);
  });

  it("acentuação do resto da frase é preservada", () => {
    expect(corrigirTermos("A excavadora está em Cachoeiro de Itapemirim, à espera do sócio."))
      .toBe("A escavadeira está em Cachoeiro de Itapemirim, à espera do sócio.");
  });

  it("só troca a palavra inteira, nunca um pedaço de outra", () => {
    expect(corrigirTermos("escavadeirazinha")).toBe("escavadeirazinha");
    expect(corrigirTermos("supercargadoras")).toBe("supercargadoras");
  });

  it("vazio e nulo não quebram", () => {
    expect(corrigirTermos("")).toBe("");
    expect(corrigirTermos(null)).toBe("");
    expect(corrigirTermos(undefined)).toBe("");
  });

  it("várias trocas na mesma frase", () => {
    expect(corrigirTermos("A excavadora e a retroexcavadora com enganche de 20%."))
      .toBe("A escavadeira e a retroescavadeira com entrada de 20%.");
  });
});

describe("listas", () => {
  it("corrige item a item e descarta vazios", () => {
    expect(corrigirTermosNaLista(["quer uma excavadora", "", "   ", "pagar com enganche"]))
      .toEqual(["quer uma escavadeira", "pagar com entrada"]);
  });

  it("lista ausente vira lista vazia", () => {
    expect(corrigirTermosNaLista(null)).toEqual([]);
    expect(corrigirTermosNaLista(undefined)).toEqual([]);
  });
});
