// "Eu vinculei a conversa do Wadson em uma negociação e ao invés das
//  informações ficarem juntas ele atualizou o nome do cliente e modificou o que
//  já estava lá. Não é pra modificar o nome ou cadastro do cliente quando eu
//  vincular uma conversa a uma negociação."
//
// "BWB continua ainda no lugar do Wadson, quero que volte ao que era antes."
//
// Vincular grava o clienteId da negociação na conversa, e a lista dava a
// palavra final ao nome do CADASTRO — então a conversa do Wadson passava a se
// chamar "Bwb Terraplanagem Ltda".
//
// A primeira tentativa de conserto errou a mira: deixava o cadastro mandar no
// nome quando não desse para PROVAR que era outra pessoa, e a prova era o
// telefone. Cadastro de empresa costuma entrar sem telefone — sem prova, a Bwb
// seguia por cima do Wadson. Agora a regra é direta: manda o nome do CONTATO.

import { describe, it, expect } from "vitest";
import { mesmoTelefone, cadastroPodeDarONome, nomeDaConversa, cadastroAoLado } from "@/lib/conversa-identidade";

// O caso real que gerou o pedido.
const WADSON = {
  isGroup: false,
  groupName: null,
  contactName: "Wadson Pires Ratinho",
  externalPhone: "5528999227268",
  clienteNome: "Bwb Terraplanagem Ltda",
};

describe("vincular a conversa não troca o nome de quem conversa", () => {
  it("a conversa do Wadson continua sendo do Wadson", () => {
    expect(nomeDaConversa(WADSON)).toBe("Wadson Pires Ratinho");
    expect(cadastroPodeDarONome(WADSON)).toBe(false);
  });

  it("e o cadastro da empresa aparece AO LADO, não no lugar", () => {
    expect(cadastroAoLado(WADSON)).toBe("Bwb Terraplanagem Ltda");
  });

  it("cadastro SEM telefone também não toma o lugar — era o furo da 1ª tentativa", () => {
    // Cadastro de empresa quase sempre entra só com o nome. A regra antiga
    // tratava "sem telefone" como "não dá para provar que é outro" e deixava o
    // cadastro mandar. Resultado: a Bwb continuava por cima do Wadson.
    expect(nomeDaConversa(WADSON)).toBe("Wadson Pires Ratinho");
    expect(cadastroAoLado(WADSON)).toBe("Bwb Terraplanagem Ltda");
  });

  it("nem quando o cadastro tem o MESMO número da conversa", () => {
    // Acontece quando o cadastro nasceu desta própria conversa. Mesmo aí, quem
    // dá nome à conversa é o contato.
    expect(nomeDaConversa({ ...WADSON, clienteNome: "Bwb Terraplanagem Ltda" })).toBe("Wadson Pires Ratinho");
  });
});

describe("o pedido anterior continua valendo: manda a agenda, não o perfil", () => {
  // "Nome do contato: usar a agenda do celular, não o perfil". O nome da agenda
  // NÃO vem do cadastro: a sincronização de contatos (lib/whatsapp-nomes.ts)
  // grava o nome da agenda no próprio contactName, preferindo-o ao nome de
  // perfil. Por isso dar a palavra ao contactName É dar a palavra à agenda.
  it("o contactName é o nome exibido, e é nele que a agenda é gravada", () => {
    const daAgenda = {
      isGroup: false,
      groupName: null,
      contactName: "José Carlos Almeida", // veio da agenda pela sincronização
      externalPhone: "5528999798168",
      clienteNome: "José Carlos Almeida",
    };
    expect(nomeDaConversa(daAgenda)).toBe("José Carlos Almeida");
    // Cadastro de mesmo nome não vira etiqueta repetida ao lado.
    expect(cadastroAoLado(daAgenda)).toBeNull();
  });
});

describe("o cadastro só entra quando a conversa não tem nome nenhum", () => {
  const semNome = {
    isGroup: false,
    groupName: null,
    contactName: null,
    externalPhone: "5528999798168",
    clienteNome: "Construtora Litoral",
  };

  it("empresta o nome em vez de mostrar um número cru", () => {
    expect(cadastroPodeDarONome(semNome)).toBe(true);
    expect(nomeDaConversa(semNome)).toBe("Construtora Litoral");
  });

  it("e aí não aparece também ao lado — seria o mesmo nome duas vezes", () => {
    expect(cadastroAoLado(semNome)).toBeNull();
  });

  it("sem cadastro e sem nome no WhatsApp, sobra o número", () => {
    expect(nomeDaConversa({ ...semNome, clienteNome: null })).toBe("5528999798168");
    expect(cadastroAoLado({ ...semNome, clienteNome: null })).toBeNull();
  });
});

describe("o resto da escada de nomes", () => {
  it("o nome recém-digitado na tela passa na frente de tudo", () => {
    expect(nomeDaConversa(WADSON, "Wadson (obra Linhares)")).toBe("Wadson (obra Linhares)");
  });

  it("grupo é outro assunto: vale o nome do grupo", () => {
    const grupo = { ...WADSON, isGroup: true, groupName: "Obra Linhares — BWB" };
    expect(nomeDaConversa(grupo)).toBe("Obra Linhares — BWB");
    // E o cadastro ligado ao grupo aparece ao lado, porque nunca é o título.
    expect(cadastroAoLado(grupo)).toBe("Bwb Terraplanagem Ltda");
  });
});

describe("mesmoTelefone — usado para marcar os vínculos antigos, não para nomear", () => {
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
