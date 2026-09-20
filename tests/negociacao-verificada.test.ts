// O card "Negociação" do painel do Orientador passou a mostrar três coisas —
// máquina, valor e como o cliente vai pagar — cada uma com "Verificado" em
// verde quando já foi identificada.
//
// A regra que justifica o módulo: o campo tipoPagamento guarda tanto condição
// de pagamento de verdade quanto nível de interesse, porque os dois saem do
// mesmo <select> do formulário de negociação. "Pesquisa de preço" não é forma
// de pagamento e não pode sair marcada como verificada.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { maquinaDaNegociacao, pagamentoDaNegociacao } from "@/lib/negociacao-verificada";

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

  it("o texto livre antigo ainda vale, desde que diga uma das quatro", () => {
    expect(pagamentoDaNegociacao("pesquisa_preco", "Finame Banco do Brasil")).toBe("Financiado");
    expect(pagamentoDaNegociacao(null, "consórcio")).toBe("Consórcio");
  });

  it("texto livre que não diz a forma fica como não definido, e não com o ✓", () => {
    // "entrada de 30% + 48x" descreve as condições, mas não diz se é banco,
    // consórcio ou parcelamento da casa. Marcar isso como confirmado é o
    // mesmo defeito do "Pagamento: outro" que apareceu na tela: símbolo de
    // confirmado num campo que ninguém confirmou.
    expect(pagamentoDaNegociacao("pesquisa_preco", "entrada de 30% + 48x")).toBe(null);
    expect(pagamentoDaNegociacao(null, "a combinar")).toBe(null);
  });

  it('"outro" nunca aparece como confirmado — foi o erro reportado', () => {
    expect(pagamentoDaNegociacao("outro", null)).toBe(null);
    expect(pagamentoDaNegociacao(null, "outro")).toBe(null);
  });

  it("nada definido continua nada definido", () => {
    expect(pagamentoDaNegociacao(null, null)).toBe(null);
    expect(pagamentoDaNegociacao("", "  ")).toBe(null);
  });
});

// ── UM RESUMO SÓ, E O QUE PASSA PELA CONFERÊNCIA ────────────────────────────
//
// "esse resumo da primeira imagem ficou muito melhor que o que está abaixo do
//  nome do cliente, remova o que fica embaixo do nome"
//
// Eram dois resumos do mesmo cliente na mesma tela, de origens diferentes:
//
//   embaixo do nome — a última linha do resumoTexto, o LOG que o ZEUS escreve
//     mensagem a mensagem, sem releitura e sem conferência. Dizia "cliente
//     enviou documentos".
//   no Orientador  — resumoNegociacao, lido da conversa inteira, com as regras
//     contra invenção e passando por conferirResumo. Dizia o contrário: que a
//     documentação ainda estava para chegar.
//
// Uma das duas estava errada, e a errada vinha primeiro. Ficou a conferida, e
// no lugar de cima. Este teste guarda o lugar dela.
describe("o painel mostra UM resumo, e é o do Orientador", () => {
  const painel = readFileSync(resolve(__dirname, "../src/components/AtendimentoClient.tsx"), "utf8");

  it("o log do cliente não é mais impresso no card", () => {
    expect(painel).not.toContain("contexto.cliente.resumoTexto");
    expect(painel).not.toContain("assuntoDaUltimaConversa");
  });

  it("o resumo do Orientador abre o card do cliente", () => {
    expect(painel).toContain("{contexto.orientador.resumoNegociacao}");
  });

  it('não cobra nota: "Sua condução" saiu do painel', () => {
    // "Do orientador dentro do atendimento retire esse card de todos."
    // A IA continua avaliando a condução — é ela que orienta a "Melhor
    // resposta" —, só não fica mais dando nota de 0 a 10 na tela.
    expect(painel).not.toContain("Sua condução");
    expect(painel).not.toContain("conducao.nota");
    expect(painel).not.toContain("conducao.acertos");
    expect(painel).not.toContain("conducao.correcoes");
  });

  it("e não se repete lá embaixo, no card do Orientador", () => {
    // A linha solta "{o.resumoNegociacao && <p …>}" era a segunda impressão
    // do mesmo texto na mesma tela.
    expect(painel).not.toContain("o.resumoNegociacao");
  });
});
