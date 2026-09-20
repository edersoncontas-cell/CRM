// "Quero que todos os contatos que tem esse padrão de numeros no lugar do
//  numero de telefone sejam excluídos definitivamente do CRM e não será mais
//  permitido o sistema salvar contatos com esse padrão numérico, ou é o
//  contato verdadeiro do cliente ou não fica cadastrado."
//
// O padrão da tela — 100175850774738 — é um LID do WhatsApp: o identificador
// interno que o aplicativo usa quando não entrega o número real. Ele não
// disca e não recebe nada fora do WhatsApp; só ocupa o lugar do telefone de
// verdade e faz o cadastro parecer completo quando não está.
//
// Estes testes guardam as duas pontas: o LID nunca passa, e telefone de
// verdade nunca é recusado por engano — barrar cliente bom seria pior que o
// problema original.

import { describe, it, expect } from "vitest";
import {
  ehTelefoneReal, ehLidWhatsApp, telefoneRecusado, telefoneParaGravar,
  nacionalDoTelefone, motivoTelefoneRecusado,
} from "@/lib/telefone-valido";

const LID = "100175850774738";

describe("o LID do WhatsApp não é telefone", () => {
  it("o número exato que apareceu na tela é recusado", () => {
    expect(ehTelefoneReal(LID)).toBe(false);
    expect(ehLidWhatsApp(LID)).toBe(true);
    expect(telefoneRecusado(LID)).toBe(true);
    expect(telefoneParaGravar(LID)).toBe(null);
  });

  it("qualquer LID com 14+ dígitos cai junto", () => {
    expect(ehLidWhatsApp("12345678901234")).toBe(true);
    expect(ehLidWhatsApp("123456789012345678")).toBe(true);
    expect(telefoneRecusado("234518819634701")).toBe(true);
  });

  it("nem com máscara ele escapa", () => {
    expect(telefoneRecusado("+100175850774738")).toBe(true);
    expect(telefoneRecusado("10017585-0774738")).toBe(true);
  });

  it("a mensagem da tela explica o que é, em vez de só dizer 'inválido'", () => {
    expect(motivoTelefoneRecusado(LID)).toMatch(/identificador interno do WhatsApp/);
    expect(motivoTelefoneRecusado("123")).toMatch(/DDD/);
  });
});

describe("telefone de verdade continua passando", () => {
  it("celular do ES, com e sem o 55", () => {
    expect(ehTelefoneReal("28999798168")).toBe(true);
    expect(ehTelefoneReal("5528999798168")).toBe(true);
    expect(ehTelefoneReal("+55 (28) 99979-8168")).toBe(true);
  });

  it("fixo de 10 dígitos", () => {
    expect(ehTelefoneReal("2833221100")).toBe(true);
    expect(ehTelefoneReal("552833221100")).toBe(true);
  });

  it("zeros à esquerda não atrapalham", () => {
    expect(ehTelefoneReal("028999798168")).toBe(true);
  });

  it("o que é gravado é o nacional, sem o 55", () => {
    expect(telefoneParaGravar("5528999798168")).toBe("28999798168");
    expect(telefoneParaGravar("+55 (28) 3322-1100")).toBe("2833221100");
  });

  it("DDD de todo o Brasil vale — cliente de fora do ES existe", () => {
    expect(ehTelefoneReal("11987654321")).toBe(true);
    expect(ehTelefoneReal("99987654321")).toBe(true);
  });
});

describe("o que não é telefone nem LID", () => {
  it("curto demais", () => {
    expect(ehTelefoneReal("123")).toBe(false);
    expect(ehTelefoneReal("999798168")).toBe(false); // sem DDD
    expect(telefoneRecusado("999798168")).toBe(true);
  });

  it("DDD impossível", () => {
    // Não existe DDD 10 (começam em 11).
    expect(ehTelefoneReal("10999798168")).toBe(false);
    expect(ehTelefoneReal("1099979816")).toBe(false);
  });

  it("mas o zero de tronco na frente é só zero de tronco", () => {
    // "01999798168" é o velho jeito de discar 19 (Campinas). Tirar o zero e
    // recusar o número seria barrar cliente de verdade.
    expect(ehTelefoneReal("01999798168")).toBe(true);
    expect(telefoneParaGravar("01999798168")).toBe("1999798168");
  });

  it("celular de 11 dígitos tem de começar com 9", () => {
    expect(ehTelefoneReal("28899798168")).toBe(false);
  });

  it("12 ou 13 dígitos sem ser 55 na frente não é telefone", () => {
    expect(ehTelefoneReal("289997981680")).toBe(false);
    expect(nacionalDoTelefone("289997981680")).toBe("289997981680");
  });
});

describe("cadastro SEM telefone continua valendo", () => {
  // Muita empresa entra no CRM só com o nome. Recusar o vazio transformaria
  // esta correção num bloqueio pior que o problema.
  it("vazio não é recusado", () => {
    expect(telefoneRecusado(null)).toBe(false);
    expect(telefoneRecusado(undefined)).toBe(false);
    expect(telefoneRecusado("")).toBe(false);
    expect(telefoneRecusado("   ")).toBe(false);
  });

  it("mas vazio também não vira telefone", () => {
    expect(telefoneParaGravar("")).toBe(null);
    expect(ehTelefoneReal("")).toBe(false);
  });
});
