import { describe, it, expect } from "vitest";
import { chaveBusca, filtrarCidades } from "@/lib/filtrar-cidades";

// Amostra no formato que o IBGE devolve (já em ordem alfabética do pt-BR).
const SP = [
  "Águas da Prata", "Águas de Lindóia", "Águas de Santa Bárbara", "Águas de São Pedro",
  "Agudos", "Salto", "Santa Bárbara d'Oeste", "Santo André", "Santos", "São Bernardo do Campo",
  "São Caetano do Sul", "São José do Rio Preto", "São Paulo", "Sorocaba", "Ubatuba",
];

describe("filtro de cidade digitada", () => {
  it("digitar S mostra só as cidades com S — e não as de Águas", () => {
    const r = filtrarCidades(SP, "S");
    expect(r).not.toContain("Águas da Prata");
    expect(r).not.toContain("Agudos");
    expect(r[0]).toBe("Salto");
    expect(r).toContain("São Paulo");
  });

  it("ignora acento nos dois lados", () => {
    // "Águas de São Pedro" também contém "sao p", mas vem depois de quem começa.
    expect(filtrarCidades(SP, "sao p")).toEqual(["São Paulo", "Águas de São Pedro"]);
    expect(filtrarCidades(SP, "SÃO PAULO")).toEqual(["São Paulo"]);
    expect(filtrarCidades(SP, "aguas de s")).toEqual(["Águas de Santa Bárbara", "Águas de São Pedro"]);
  });

  it("quem começa com o texto vem antes de quem casa numa palavra do meio", () => {
    const r = filtrarCidades(["Bernardo", "São Bernardo do Campo", "Bernardino"], "bernardo");
    expect(r).toEqual(["Bernardo", "São Bernardo do Campo"]);
  });

  it("acha pelo segundo nome da cidade", () => {
    expect(filtrarCidades(SP, "campo")).toEqual(["São Bernardo do Campo"]);
    // Nenhuma das duas começa com "barbara", então vale a ordem alfabética.
    expect(filtrarCidades(SP, "barbara")).toEqual(["Águas de Santa Bárbara", "Santa Bárbara d'Oeste"]);
  });

  it("não casa no meio de uma palavra", () => {
    // "Águas" tem s, mas preso no fim da palavra — não pode aparecer no "S".
    expect(filtrarCidades(SP, "s")).not.toContain("Águas da Prata");
    expect(filtrarCidades(SP, "auba")).toEqual([]); // pedaço do meio de "Ubatuba"
  });

  it("campo vazio devolve a lista inteira (respeitando o limite)", () => {
    expect(filtrarCidades(SP, "")).toHaveLength(SP.length);
    expect(filtrarCidades(SP, "   ")).toHaveLength(SP.length);
    expect(filtrarCidades(SP, "", 3)).toEqual(SP.slice(0, 3));
  });

  it("texto que não existe devolve vazio (o vendedor pode digitar à mão)", () => {
    expect(filtrarCidades(SP, "xyz")).toEqual([]);
  });

  it("respeita o limite mesmo com muitos resultados", () => {
    expect(filtrarCidades(SP, "s", 3)).toHaveLength(3);
  });

  it("apóstrofo e espaços não atrapalham", () => {
    expect(filtrarCidades(SP, "santa barbara d'o")).toEqual(["Santa Bárbara d'Oeste"]);
    expect(chaveBusca("  São Paulo  ")).toBe("sao paulo");
  });
});
