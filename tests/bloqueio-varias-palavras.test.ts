// "classifique todos os contatos que tem esses dizeres no nome como NÃO
//  CLIENTES" — e neste CRM "não é cliente" quer dizer sai do CRM, com lápide
//  para não voltar.
//
// A varredura já fazia isso. O que ela NÃO fazia era enxergar termo de duas
// palavras na caixa "Palavras inteiras": a regra antiga perguntava se alguma
// palavra do nome era igual ao termo INTEIRO, e como nenhuma palavra contém
// espaço, "new holland" — que está na lista do vendedor — nunca bateu em nada.
// Ficava na tela parecendo que filtrava, e o contato passava direto.

import { describe, it, expect } from "vitest";
import { motivoBloqueioComListas } from "@/lib/utils";

// A lista real do vendedor, como está no card de Configurações.
const PALAVRAS = [
  "banco", "cnh", "bcnh", "pme", "dynapac", "iron", "helpcar", "croma",
  "daycoval", "itau", "banestes", "contabilidade", "contábeis", "contabil",
  "contador", "escritório", "financeiro", "pneus", "oficina", "bradesco",
  "sicoob", "sicredi", "hotel", "pousada", "restaurante", "brasil", "deutsche",
  "prefeitura", "crm", "central", "new holland", "credito", "consultoria",
  "transportadora", "frete",
];
const TERMOS = ["financeiro"];

const motivo = (nome: string) => motivoBloqueioComListas(nome, TERMOS, PALAVRAS);

describe("termo de duas palavras — o que estava escapando", () => {
  it("'new holland' agora pega os nomes que tinham de pegar", () => {
    expect(motivo("New Holland Vitória")).toBe("new holland");
    expect(motivo("Consultor New Holland ES")).toBe("new holland");
    // Hífen, dois-pontos, espaço duplo: tudo separador, a sequência continua lá.
    expect(motivo("NEW HOLLAND - Suporte")).toBe("new holland");
    expect(motivo("NEW  HOLLAND")).toBe("new holland");
  });

  it("e continua sendo PALAVRA INTEIRA, não pedaço", () => {
    expect(motivo("Newholland Peças")).toBeNull();
    expect(motivo("Renew Hollander")).toBeNull();
    // As duas palavras têm de vir juntas e na ordem.
    expect(motivo("Holland New Ltda")).toBeNull();
    expect(motivo("New Motores e Holland Tratores")).toBeNull();
  });
});

describe("o que já funcionava continua igual", () => {
  it("palavra inteira pega o nome certo", () => {
    expect(motivo("Banco do Brasil")).toBe("banco");
    expect(motivo("Contabilidade Silva")).toBe("contabilidade");
    expect(motivo("Hotel Center Guarapari")).toBe("hotel");
    expect(motivo("Prefeitura de Linhares")).toBe("prefeitura");
  });

  it("e não pega quem só se parece", () => {
    expect(motivo("Bancorbrás Turismo")).toBeNull();
    expect(motivo("João da Silva")).toBeNull();
  });

  it("acento na lista ou no nome não atrapalha", () => {
    expect(motivo("Escritorio Souza")).toBe("escritório");
    expect(motivo("Escritório Souza")).toBe("escritório");
  });

  it("pedaço de palavra continua pegando dentro da palavra", () => {
    expect(motivoBloqueioComListas("Refinanceiro Ltda", ["financeir"], [])).toBe("financeir");
  });

  it("asterisco no nome vale mais que a lista", () => {
    expect(motivo("Compadre Zé *")).toBe("asterisco no nome (*)");
  });
});

describe("a trava contra a lista mal preenchida continua de pé", () => {
  it("termo curto demais não apaga ninguém", () => {
    expect(motivoBloqueioComListas("Sá Comércio", [], ["sa"])).toBeNull();
    expect(motivoBloqueioComListas("A B Terraplanagem", [], ["a b"])).toBeNull();
  });

  it("três letras é o mínimo, e vale também para o termo de duas palavras", () => {
    expect(motivoBloqueioComListas("PME Máquinas", [], ["pme"])).toBe("pme");
    // "a bc" tem 3 letras somando as palavras: passa no mínimo.
    expect(motivoBloqueioComListas("A BC Ltda", [], ["a bc"])).toBe("a bc");
  });
});
