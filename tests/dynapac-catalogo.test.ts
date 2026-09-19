import { describe, it, expect } from "vitest";
import {
  CATALOGO_DYNAPAC, MODELOS_DYNAPAC, RENOMEAR_DYNAPAC, DYNAPAC_FORA_DE_LINHA, nomeCurtoRoloSolo,
} from "@/lib/dynapac-catalogo";
import { extrairMaquina } from "@/lib/ai/heuristics";

describe("nome curto dos rolos de solo", () => {
  it("tira os dois zeros do meio e separa o sufixo", () => {
    expect(nomeCurtoRoloSolo("CA6500D")).toBe("CA65 D");
    expect(nomeCurtoRoloSolo("ca6500 pd")).toBe("CA65 PD");
    expect(nomeCurtoRoloSolo("CA2500")).toBe("CA25 D");
    expect(nomeCurtoRoloSolo("CA1300D")).toBe("CA13 D");
  });

  it("aceita quem já escreve no formato novo", () => {
    expect(nomeCurtoRoloSolo("CA25D")).toBe("CA25 D");
    expect(nomeCurtoRoloSolo("ca25 pd")).toBe("CA25 PD");
  });

  it("não mexe em quem não é rolo de solo", () => {
    expect(nomeCurtoRoloSolo("CC2200 VI")).toBe("CC2200 VI");
    expect(nomeCurtoRoloSolo("CP2100")).toBe("CP2100");
    expect(nomeCurtoRoloSolo("SD2500CS")).toBe("SD2500CS");
  });
});

describe("catálogo Dynapac", () => {
  it("não tem modelo repetido", () => {
    expect(new Set(MODELOS_DYNAPAC).size).toBe(MODELOS_DYNAPAC.length);
  });

  it("nenhum rolo de solo carrega os zeros antigos", () => {
    const solo = CATALOGO_DYNAPAC.filter((m) => m.categoria === "rolo_solo");
    expect(solo.length).toBeGreaterThan(0);
    for (const m of solo) expect(m.modelo).toMatch(/^CA\d{2} (D|PD)$/);
  });

  it("cada rolo de solo tem as duas versões, lisa e pé-de-carneiro", () => {
    const familias = new Set(
      CATALOGO_DYNAPAC.filter((m) => m.categoria === "rolo_solo").map((m) => m.modelo.split(" ")[0])
    );
    for (const f of familias) {
      expect(MODELOS_DYNAPAC).toContain(`${f} D`);
      expect(MODELOS_DYNAPAC).toContain(`${f} PD`);
    }
  });

  it("traz os tipos que o vendedor pediu", () => {
    const categorias = new Set(CATALOGO_DYNAPAC.map((m) => m.categoria));
    for (const c of ["rolo_solo", "rolo_tandem", "rolo_pneumatico", "paver", "alimentador", "fresadora", "leve"]) {
      expect(categorias).toContain(c);
    }
    expect(MODELOS_DYNAPAC).toContain("D.ONE");
    expect(MODELOS_DYNAPAC).toContain("CC2200 VI");
  });

  it("todo nome antigo aponta para um modelo que existe hoje", () => {
    for (const novo of Object.values(RENOMEAR_DYNAPAC)) expect(MODELOS_DYNAPAC).toContain(novo);
  });

  it("o que saiu de linha não voltou pelo catálogo", () => {
    for (const fora of DYNAPAC_FORA_DE_LINHA) expect(MODELOS_DYNAPAC).not.toContain(fora);
  });
});

describe("a conversa do WhatsApp entende os dois jeitos de escrever", () => {
  it("nome antigo vira nome novo", () => {
    expect(extrairMaquina("tenho interesse no CA2500")).toBe("CA25 D");
    expect(extrairMaquina("me passa o preço do ca6500 pd")).toBe("CA65 PD");
  });

  it("nome novo, com ou sem espaço", () => {
    expect(extrairMaquina("quero um CA25D")).toBe("CA25 D");
    expect(extrairMaquina("o CA65 PD atende?")).toBe("CA65 PD");
  });

  it("sem sufixo assume cilindro liso", () => {
    expect(extrairMaquina("preciso de um CA25 para a obra")).toBe("CA25 D");
  });

  it("continua achando os modelos New Holland", () => {
    expect(extrairMaquina("a E215C serve?")).toBe("E215C");
    expect(extrairMaquina("retro B95C")).toBe("B95C");
  });

  it("tandem e pneumático saem com o nome oficial", () => {
    expect(extrairMaquina("o CC2200 VI é nacional?")).toBe("CC2200 VI");
    expect(extrairMaquina("pneumático CP2100")).toBe("CP2100");
  });
});
