import { describe, it, expect } from "vitest";
import { primeiroNome, personalizarTexto, modeloAbordagemPadrao, dividirEmLotes, periodoSemanaQueVem } from "../src/lib/abordagem-cidade-regra";

describe("abordagem por cidade", () => {
  it("primeiro nome com maiúscula, e vazio quando o cadastro é só número", () => {
    expect(primeiroNome("JOÃO DA SILVA")).toBe("João");
    expect(primeiroNome("  maria   souza ")).toBe("Maria");
    expect(primeiroNome("27 99999-8888")).toBe("");
    expect(primeiroNome("Contato 5527999998888")).toBe("");
  });

  it("troca {nome} e não deixa vírgula solta quando não há nome", () => {
    expect(personalizarTexto("Olá {nome}, tudo bem?", "Zé da Obra")).toBe("Olá Zé, tudo bem?");
    expect(personalizarTexto("Olá {nome}, tudo bem?", "Contato 5527999998888")).toBe("Olá, tudo bem?");
    expect(personalizarTexto("Bom dia {NOME} !", "ana")).toBe("Bom dia Ana!");
  });

  it("modelo padrão cita a cidade e o período e tem o {nome}", () => {
    const t = modeloAbordagemPadrao("Cachoeiro de Itapemirim", "na semana que vem (22/09 a 26/09)");
    expect(t).toContain("Cachoeiro de Itapemirim");
    expect(t).toContain("22/09 a 26/09");
    expect(t).toContain("{nome}");
  });

  it("divide em lotes do tamanho pedido", () => {
    expect(dividirEmLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(dividirEmLotes([], 3)).toEqual([]);
    expect(dividirEmLotes([1, 2], 0)).toEqual([[1], [2]]);
  });

  it("semana que vem vai da próxima segunda à sexta, em Brasília", () => {
    // Quinta 17/09/2026 → 21/09 a 25/09
    expect(periodoSemanaQueVem(new Date("2026-09-17T15:00:00Z"))).toBe("na semana que vem (21/09 a 25/09)");
    // Domingo 20/09 → segunda é amanhã, 21/09
    expect(periodoSemanaQueVem(new Date("2026-09-20T15:00:00Z"))).toBe("na semana que vem (21/09 a 25/09)");
    // Segunda 21/09 → a próxima, 28/09 a 02/10
    expect(periodoSemanaQueVem(new Date("2026-09-21T15:00:00Z"))).toBe("na semana que vem (28/09 a 02/10)");
    // 23h de sábado 19/09 em Brasília já é 02h UTC de domingo — continua semana de 21/09
    expect(periodoSemanaQueVem(new Date("2026-09-20T02:00:00Z"))).toBe("na semana que vem (21/09 a 25/09)");
  });
});
