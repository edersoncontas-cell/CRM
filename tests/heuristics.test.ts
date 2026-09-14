import { describe, it, expect } from "vitest";
import {
  extrairValor, extrairCondicaoPagamento, extrairConcorrente, extrairDataVisita,
  extrairTelefone, extrairMunicipio, extrairNome, detectarSentimento,
} from "@/lib/ai/heuristics";

describe("extrairValor", () => {
  it("lê milhões, mil e R$", () => {
    expect(extrairValor("tá em 1,2 milhão")).toBe(1_200_000);
    expect(extrairValor("uns 450 mil")).toBe(450_000);
    expect(extrairValor("R$ 380.000,00 à vista")).toBe(380_000);
  });
  it("ignora números pequenos e texto sem valor", () => {
    expect(extrairValor("R$ 500 de frete")).toBeNull();
    expect(extrairValor("bom dia, tudo bem?")).toBeNull();
  });
});

describe("condição de pagamento e concorrente", () => {
  it("classifica a forma de pagamento", () => {
    expect(extrairCondicaoPagamento("pago à vista no pix")).toBe("avista");
    expect(extrairCondicaoPagamento("tenho carta de consórcio")).toBe("consorcio");
    expect(extrairCondicaoPagamento("vou financiar pelo Finame")).toBe("financiamento");
    expect(extrairCondicaoPagamento("oi")).toBeNull();
  });
  it("detecta concorrente citado", () => {
    expect(extrairConcorrente("a CAT ofereceu mais barato")).toBe("CAT");
    expect(extrairConcorrente("sem concorrente")).toBeNull();
  });
});

describe("extrairDataVisita", () => {
  const base = new Date(2026, 8, 14, 10, 0, 0); // segunda, 14/09/2026
  it("data explícita com hora", () => {
    const d = extrairDataVisita("pode vir dia 20/09 às 14h", base)!;
    expect([d.getDate(), d.getMonth(), d.getHours()]).toEqual([20, 8, 14]);
  });
  it("amanhã e dia da semana", () => {
    const a = extrairDataVisita("amanhã 9:30", base)!;
    expect([a.getDate(), a.getHours(), a.getMinutes()]).toEqual([15, 9, 30]);
    const q = extrairDataVisita("quinta às 8", base)!;
    expect(q.getDay()).toBe(4);
    expect(q.getHours()).toBe(8);
  });
  it("sem marcador temporal", () => {
    expect(extrairDataVisita("manda o preço", base)).toBeNull();
  });
});

describe("telefone, município e nome", () => {
  it("telefone brasileiro só com dígitos", () => {
    expect(extrairTelefone("me liga no (28) 99999-1234")).toBe("28999991234");
    expect(extrairTelefone("sem número")).toBeNull();
  });
  it("município do ES, priorizando nome mais longo", () => {
    expect(extrairMunicipio("obra aqui em cachoeiro de itapemirim")).toBe("Cachoeiro de Itapemirim");
    expect(extrairMunicipio("sou de Vila Velha")).toBe("Vila Velha");
    expect(extrairMunicipio("sou de Belo Horizonte")).toBeNull();
  });
  it("nome em frase explícita ou no remetente exportado", () => {
    expect(extrairNome("Bom dia, me chamo Carlos Alberto")).toBe("Carlos Alberto");
    expect(extrairNome("12/06/2026 14:30 - Joao Pedreira: quero uma retro")).toBe("Joao Pedreira");
  });
});

describe("detectarSentimento", () => {
  it("positivo, negativo e neutro", () => {
    expect(detectarSentimento("gostei, vamos fechar")).toBe("positivo");
    expect(detectarSentimento("achei caro, deixa pra depois")).toBe("negativo");
    expect(detectarSentimento("manda a ficha técnica")).toBe("neutro");
    expect(detectarSentimento("gostei mas está caro")).toBe("neutro");
  });
});
