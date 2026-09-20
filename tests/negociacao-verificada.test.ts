// O card "Negociação" do painel do Orientador passou a mostrar três coisas —
// máquina, valor e como o cliente vai pagar — cada uma com "Verificado" em
// verde quando já foi identificada.
//
// A regra que justifica o módulo: o campo tipoPagamento guarda tanto condição
// de pagamento de verdade quanto nível de interesse, porque os dois saem do
// mesmo <select> do formulário de negociação. "Pesquisa de preço" não é forma
// de pagamento e não pode sair marcada como verificada.

import { describe, it, expect } from "vitest";
import { maquinaDaNegociacao, pagamentoDaNegociacao, assuntoDaUltimaConversa } from "@/lib/negociacao-verificada";

describe("máquina da negociação", () => {
  it("junta marca e modelo", () => {
    expect(maquinaDaNegociacao("New Holland", "B110")).toBe("New Holland B110");
    expect(maquinaDaNegociacao("Dynapac", "CA250")).toBe("Dynapac CA250");
  });

  it("não repete a marca quando o modelo já a traz", () => {
    expect(maquinaDaNegociacao("New Holland", "New Holland B110")).toBe("New Holland B110");
    expect(maquinaDaNegociacao("new holland", "New Holland E145C EVO")).toBe("New Holland E145C EVO");
  });

  it("sem modelo não há máquina identificada", () => {
    expect(maquinaDaNegociacao("New Holland", null)).toBe(null);
    expect(maquinaDaNegociacao("New Holland", "   ")).toBe(null);
    expect(maquinaDaNegociacao(null, null)).toBe(null);
  });

  it("modelo sem marca vale sozinho", () => {
    expect(maquinaDaNegociacao(null, "B110")).toBe("B110");
  });
});

describe("condição de pagamento", () => {
  it("traduz as quatro formas para o vocabulário do vendedor", () => {
    expect(pagamentoDaNegociacao("avista", null)).toBe("À vista");
    expect(pagamentoDaNegociacao("financiamento", null)).toBe("Financiado");
    expect(pagamentoDaNegociacao("consorcio", null)).toBe("Consórcio");
    expect(pagamentoDaNegociacao("crd_pme", null)).toBe("Parcelado pela casa");
  });

  it("nível de interesse NÃO é forma de pagamento", () => {
    // Saem do mesmo <select>, mas dizem outra coisa: não podem sair como
    // "Verificado · Pagamento: Pesquisa de preço".
    expect(pagamentoDaNegociacao("pesquisa_preco", null)).toBe(null);
    expect(pagamentoDaNegociacao("interesse_real", null)).toBe(null);
    expect(pagamentoDaNegociacao("outro", null)).toBe(null);
  });

  it("cai no texto livre antigo quando o estruturado não serve", () => {
    expect(pagamentoDaNegociacao("pesquisa_preco", "entrada de 30% + 48x")).toBe("entrada de 30% + 48x");
    expect(pagamentoDaNegociacao(null, "Finame Banco do Brasil")).toBe("Finame Banco do Brasil");
  });

  it("nada definido continua nada definido", () => {
    expect(pagamentoDaNegociacao(null, null)).toBe(null);
    expect(pagamentoDaNegociacao("", "  ")).toBe(null);
  });
});

describe("assunto da última conversa", () => {
  // resumoTexto é um log: uma linha "[dd/mm/aaaa] resumo" por mensagem
  // analisada. O painel pegava as DUAS últimas e colava com espaço — e como
  // linhas seguidas costumam ser quase iguais, o card saía repetido.
  const log = [
    "[10/09/2026] Pediu preço de retroescavadeira.",
    "[15/09/2026] Interesse na B110; pagamento: financiamento.",
    "[18/09/2026] Aguardando contato do cliente sobre nova necessidade de máquina.",
  ].join("\n");

  it("devolve só a última linha, sem a data", () => {
    expect(assuntoDaUltimaConversa(log)).toBe("Aguardando contato do cliente sobre nova necessidade de máquina.");
  });

  it("não cola duas linhas — era esse o duplicado", () => {
    const r = assuntoDaUltimaConversa(log)!;
    expect(r).not.toContain("B110");
    expect(r.split(".").filter((x) => x.trim()).length).toBe(1);
  });

  it("linha sem data também funciona", () => {
    expect(assuntoDaUltimaConversa("Conversa registrada.")).toBe("Conversa registrada.");
  });

  it("vazio, nulo e só espaços não viram texto", () => {
    expect(assuntoDaUltimaConversa(null)).toBe(null);
    expect(assuntoDaUltimaConversa("")).toBe(null);
    expect(assuntoDaUltimaConversa("\n  \n")).toBe(null);
  });

  it("linha em branco no fim não apaga o assunto", () => {
    expect(assuntoDaUltimaConversa(`${log}\n\n`)).toContain("Aguardando contato");
  });

  it("linha só com a data não devolve string vazia", () => {
    expect(assuntoDaUltimaConversa("[18/09/2026]")).toBe(null);
  });
});
