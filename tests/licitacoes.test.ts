// Licitações de máquina: o filtro é o que decide se o painel presta. Deixar
// passar merenda escolar enche a tela de lixo; barrar retroescavadeira faz
// perder venda. Estes testes travam as duas pontas.

import { describe, it, expect } from "vitest";
import { termosDeMaquina, cidadeAtendida, normalizarItemPncp } from "@/lib/licitacoes";

describe("o que é licitação de máquina", () => {
  it("pega as máquinas que ele vende", () => {
    expect(termosDeMaquina("Aquisição de 01 (uma) retroescavadeira 4x4")).toContain("retroescavadeira");
    expect(termosDeMaquina("AQUISIÇÃO DE PÁ CARREGADEIRA SOBRE RODAS")).toContain("pá carregadeira");
    expect(termosDeMaquina("Compra de motoniveladora nova")).toContain("motoniveladora");
    expect(termosDeMaquina("Rolo compactador vibratório de solo")).toContain("rolo compactador");
    expect(termosDeMaquina("aquisicao de escavadeira hidraulica")).toContain("escavadeira");
  });

  it("ignora o que não é máquina", () => {
    expect(termosDeMaquina("Aquisição de gêneros alimentícios para a merenda escolar")).toEqual([]);
    expect(termosDeMaquina("Contratação de serviços de limpeza urbana")).toEqual([]);
    expect(termosDeMaquina("Material de expediente e papelaria")).toEqual([]);
  });

  it("descarta aluguel, manutenção e peças — não é venda de máquina", () => {
    expect(termosDeMaquina("Locação de retroescavadeira com operador")).toEqual([]);
    expect(termosDeMaquina("Manutenção preventiva de pá carregadeira")).toEqual([]);
    expect(termosDeMaquina("Aquisição de peças para motoniveladora")).toEqual([]);
    expect(termosDeMaquina("Seguro da escavadeira municipal")).toEqual([]);
  });

  it("não repete o termo genérico quando o específico já casou", () => {
    // "escavadeira" está dentro de "retroescavadeira": mostrar os dois no chip
    // ficaria redundante na tela.
    expect(termosDeMaquina("Aquisição de retroescavadeira")).toEqual(["retroescavadeira"]);
  });

  it("acento e caixa não atrapalham", () => {
    expect(termosDeMaquina("AQUISIÇÃO DE MÁQUINA PESADA")).toContain("máquina pesada");
    expect(termosDeMaquina("aquisicao de maquina pesada")).toContain("máquina pesada");
  });
});

describe("só as cidades da área", () => {
  const cidades = ["Alegre", "Cachoeiro de Itapemirim", "Santa Maria de Jetibá", "Afonso Cláudio"];

  it("casa ignorando acento e caixa", () => {
    expect(cidadeAtendida("ALEGRE", cidades)).toBe("Alegre");
    expect(cidadeAtendida("santa maria de jetiba", cidades)).toBe("Santa Maria de Jetibá");
    expect(cidadeAtendida("Afonso Claudio", cidades)).toBe("Afonso Cláudio");
  });

  it("cidade de fora não entra", () => {
    expect(cidadeAtendida("Vitória", cidades)).toBeNull();
    expect(cidadeAtendida("", cidades)).toBeNull();
  });
});

describe("leitura do item do PNCP", () => {
  it("lê os campos principais", () => {
    const item = normalizarItemPncp({
      objetoCompra: "Aquisição de retroescavadeira",
      numeroControlePNCP: "12345678000190-1-000001/2026",
      valorTotalEstimado: 650000,
      modalidadeNome: "Pregão Eletrônico",
      dataEncerramentoProposta: "2026-10-15T13:00:00",
      unidadeOrgao: { municipioNome: "Alegre", nomeUnidade: "Prefeitura Municipal de Alegre" },
    });
    expect(item).not.toBeNull();
    expect(item!.cidade).toBe("Alegre");
    expect(item!.orgao).toBe("Prefeitura Municipal de Alegre");
    expect(item!.valor).toBe(650000);
    expect(item!.modalidade).toBe("Pregão Eletrônico");
    expect(item!.link).toContain("pncp.gov.br");
  });

  it("aguenta nome de campo diferente entre versões do portal", () => {
    const item = normalizarItemPncp({
      objeto: "Aquisição de pá carregadeira",
      orgaoEntidade: { razaoSocial: "Município de Alegre", nomeMunicipio: "Alegre" },
    });
    expect(item).not.toBeNull();
    expect(item!.objeto).toContain("carregadeira");
    expect(item!.cidade).toBe("Alegre");
  });

  it("item sem objeto é descartado em vez de virar linha vazia", () => {
    expect(normalizarItemPncp({ unidadeOrgao: { municipioNome: "Alegre" } })).toBeNull();
  });

  it("valor zerado não vira R$ 0 na tela", () => {
    const item = normalizarItemPncp({ objetoCompra: "Aquisição de escavadeira", valorTotalEstimado: 0 });
    expect(item!.valor).toBeNull();
  });
});
