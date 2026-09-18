import { describe, it, expect } from "vitest";
import {
  interpretarDataNascimento, idadeEm, idadePlausivel, nomeCombina, diasAteAniversario, aniversarioNaJanela, diaMes, dataISO, descreverOrigem,
} from "../src/lib/aniversario-regra";

const hoje = new Date("2026-09-18T15:00:00Z"); // 18/09/2026 em Brasília

describe("aniversário: interpretar a data que a IA (ou o formulário) devolve", () => {
  it("aceita ISO e dd/mm/aaaa, guarda meio-dia de Brasília", () => {
    expect(dataISO(interpretarDataNascimento("1985-03-12")!)).toBe("1985-03-12");
    expect(dataISO(interpretarDataNascimento("12/03/1985")!)).toBe("1985-03-12");
    expect(dataISO(interpretarDataNascimento("12-03-1985")!)).toBe("1985-03-12");
    expect(diaMes(interpretarDataNascimento("1985-03-12")!)).toBe("12/03");
  });

  it("rejeita lixo, datas impossíveis e tipos errados", () => {
    expect(interpretarDataNascimento(null)).toBeNull();
    expect(interpretarDataNascimento("nascido em março")).toBeNull();
    expect(interpretarDataNascimento("1985-02-31")).toBeNull();
    expect(interpretarDataNascimento("31/13/1985")).toBeNull();
    expect(interpretarDataNascimento(19850312)).toBeNull();
  });
});

describe("aniversário: idade plausível", () => {
  it("calcula a idade contando se já fez aniversário no ano", () => {
    expect(idadeEm(interpretarDataNascimento("1985-03-12")!, hoje)).toBe(41);
    expect(idadeEm(interpretarDataNascimento("1985-12-25")!, hoje)).toBe(40);
  });

  it("só entre 16 e 100 anos — o resto é leitura errada do documento", () => {
    expect(idadePlausivel(interpretarDataNascimento("1985-03-12")!, hoje)).toBe(true);
    expect(idadePlausivel(interpretarDataNascimento("2020-01-01")!, hoje)).toBe(false); // data de emissão
    expect(idadePlausivel(interpretarDataNascimento("1900-01-01")!, hoje)).toBe(false);
  });
});

describe("aniversário: o documento é da mesma pessoa do cadastro?", () => {
  it("primeiro nome igual basta; acento e caixa não contam", () => {
    expect(nomeCombina("José Carlos", "JOSE CARLOS DA SILVA")).toBe(true);
    expect(nomeCombina("Adailton Christophori", "Adailton C. Souza")).toBe(true);
  });

  it("dois nomes em comum também servem quando o primeiro é apelido", () => {
    expect(nomeCombina("Zé Carlos Silva", "José Carlos Silva")).toBe(true);
  });

  it("nome diferente, cadastro só com número ou apelido solto: não combina", () => {
    expect(nomeCombina("Adailton Christophori", "Maria Aparecida Souza")).toBe(false);
    expect(nomeCombina("27999990001", "José Carlos da Silva")).toBe(false);
    expect(nomeCombina("Zé da Terraplanagem", "José Carlos da Silva")).toBe(false);
  });
});

describe("aniversário: próximos aniversariantes", () => {
  it("conta os dias até o próximo aniversário, inclusive hoje = 0 e virada de ano", () => {
    expect(diasAteAniversario(interpretarDataNascimento("1980-09-18")!, hoje)).toBe(0);
    expect(diasAteAniversario(interpretarDataNascimento("1980-09-25")!, hoje)).toBe(7);
    expect(diasAteAniversario(interpretarDataNascimento("1980-09-17")!, hoje)).toBe(364);
    expect(diasAteAniversario(interpretarDataNascimento("1980-01-01")!, hoje)).toBe(105);
  });

  it("29/02 em ano sem bissexto vira 28/02", () => {
    const h = new Date("2027-02-27T15:00:00Z");
    expect(diasAteAniversario(interpretarDataNascimento("1984-02-29")!, h)).toBe(1);
  });

  it("janela: hoje, 7 dias, 30 dias", () => {
    const n = interpretarDataNascimento("1980-09-25")!;
    expect(aniversarioNaJanela(n, hoje, 0)).toBe(false);
    expect(aniversarioNaJanela(n, hoje, 7)).toBe(true);
    expect(aniversarioNaJanela(interpretarDataNascimento("1980-10-20")!, hoje, 30)).toBe(false);
  });
});

describe("aniversário: origem em palavras", () => {
  it("manual e documento", () => {
    expect(descreverOrigem("manual")).toBe("informado no cadastro");
    expect(descreverOrigem("documento:CNH")).toBe("lido pela IA de CNH recebido no WhatsApp");
    expect(descreverOrigem(null)).toBeNull();
  });
});
