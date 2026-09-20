// "Eu vinculei a conversa do Wadson em uma negociação e ao invés das
//  informações ficarem juntas ele atualizou o nome do cliente e modificou o que
//  já estava lá. Retorne ao que estava antes e altere essa função: não é pra
//  modificar o nome ou cadastro do cliente quando eu vincular uma conversa a
//  uma negociação."
//
// Vincular grava o clienteId da negociação na conversa, e a lista dava a palavra
// final ao nome do CADASTRO — então a conversa do Wadson passava a se chamar
// "Bwb Terraplanagem Ltda". O cadastro do Wadson nunca foi renomeado no banco,
// mas na tela o efeito era o mesmo: ele desaparecia da própria conversa.

import { describe, it, expect } from "vitest";
import { mesmoTelefone, cadastroPodeDarONome, nomeDaConversa, cadastroAoLado } from "@/lib/conversa-identidade";

// O caso real que gerou o pedido.
const WADSON = {
  isGroup: false,
  groupName: null,
  contactName: "Wadson Pires Ratinho",
  externalPhone: "5528999112233",
  clienteNome: "Bwb Terraplanagem Ltda",
  clienteTelefone: "27988776655",
  vinculoManual: true,
};

describe("é a mesma pessoa? (a pergunta que decide o nome)", () => {
  it("o mesmo número com e sem o 55 do país é o mesmo telefone", () => {
    expect(mesmoTelefone("5528999798168", "28999798168")).toBe(true);
    expect(mesmoTelefone("(28) 99979-8168", "5528999798168")).toBe(true);
  });

  it("números diferentes não são", () => {
    expect(mesmoTelefone("28999798168", "27988776655")).toBe(false);
  });

  it("vazio nunca casa — ausência de número não é prova de nada", () => {
    expect(mesmoTelefone(null, "28999798168")).toBe(false);
    expect(mesmoTelefone("", "")).toBe(false);
  });
});

describe("vincular a conversa não troca o nome de quem conversa", () => {
  it("a conversa do Wadson continua sendo do Wadson", () => {
    expect(nomeDaConversa(WADSON)).toBe("Wadson Pires Ratinho");
  });

  it("e o cadastro da empresa aparece AO LADO, não no lugar", () => {
    expect(cadastroAoLado(WADSON)).toBe("Bwb Terraplanagem Ltda");
  });

  it("vínculo manual basta para travar, mesmo se o telefone fosse o mesmo", () => {
    // O vendedor ligou à mão e não pediu para renomear nada.
    const mesmoNumero = { ...WADSON, clienteTelefone: "28999112233" };
    expect(cadastroPodeDarONome(mesmoNumero)).toBe(false);
    expect(nomeDaConversa(mesmoNumero)).toBe("Wadson Pires Ratinho");
  });

  it("telefone diferente basta para travar, mesmo sem a marca de manual", () => {
    // É o conserto dos vínculos que já existiam antes desta regra: ninguém sabe
    // como nasceram, mas o telefone diz que são duas pessoas.
    const antigo = { ...WADSON, vinculoManual: false };
    expect(cadastroPodeDarONome(antigo)).toBe(false);
    expect(nomeDaConversa(antigo)).toBe("Wadson Pires Ratinho");
  });
});

describe("o pedido anterior continua valendo: manda a agenda, não o perfil", () => {
  // "Nome do contato: usar a agenda do celular, não o perfil" — o Google
  // Contatos traz a lista do celular para Clientes, e é esse nome que vale.
  const mesmaPessoa = {
    isGroup: false,
    groupName: null,
    contactName: "Zé da Escavadeira 🚜",
    externalPhone: "5528999798168",
    clienteNome: "José Carlos Almeida",
    clienteTelefone: "28999798168",
    vinculoManual: false,
  };

  it("cadastro da mesma pessoa, vínculo automático: vence o nome da agenda", () => {
    expect(cadastroPodeDarONome(mesmaPessoa)).toBe(true);
    expect(nomeDaConversa(mesmaPessoa)).toBe("José Carlos Almeida");
  });

  it("e aí não há nada para mostrar ao lado — seria o mesmo nome duas vezes", () => {
    expect(cadastroAoLado(mesmaPessoa)).toBeNull();
  });

  it("cadastro SEM telefone não perde o nome por isso", () => {
    // Muita empresa entra só com o nome, e a limpeza dos identificadores do
    // WhatsApp zerou o telefone de cadastros legítimos. Sem telefone não há
    // prova de que seja outra pessoa: quem decide é a marca de manual.
    const semTelefone = { ...mesmaPessoa, clienteTelefone: null };
    expect(nomeDaConversa(semTelefone)).toBe("José Carlos Almeida");
    expect(nomeDaConversa({ ...semTelefone, vinculoManual: true })).toBe("Zé da Escavadeira 🚜");
  });
});

describe("o resto da escada de nomes", () => {
  const solto = {
    isGroup: false,
    groupName: null,
    contactName: null,
    externalPhone: "5528999798168",
    clienteNome: null,
    clienteTelefone: null,
    vinculoManual: false,
  };

  it("sem cadastro e sem nome no WhatsApp, sobra o número", () => {
    expect(nomeDaConversa(solto)).toBe("5528999798168");
  });

  it("o nome recém-digitado na tela passa na frente do que veio do WhatsApp", () => {
    expect(nomeDaConversa({ ...solto, contactName: "Antigo" }, "Novo")).toBe("Novo");
  });

  it("grupo é outro assunto: vale o nome do grupo", () => {
    const grupo = { ...WADSON, isGroup: true, groupName: "Obra Linhares — BWB" };
    expect(nomeDaConversa(grupo)).toBe("Obra Linhares — BWB");
    // E o cadastro ligado ao grupo aparece ao lado, porque nunca é o título.
    expect(cadastroAoLado(grupo)).toBe("Bwb Terraplanagem Ltda");
  });

  it("sem cadastro nenhum, não há nada ao lado", () => {
    expect(cadastroAoLado(solto)).toBeNull();
  });
});
