import { describe, expect, it } from "vitest";
import { calcularLicoesVendas, type NegocioFechado } from "../src/lib/zeus/orientador-aprendizado";

const dias = (n: number) => new Date(Date.now() - n * 86_400_000);

function ganha(criadoHaDias: number, faturadoHaDias: number): NegocioFechado {
  return { status: "ganha", motivoPerda: null, criadoEm: dias(criadoHaDias), faturadoEm: dias(faturadoHaDias), atualizadoEm: dias(faturadoHaDias) };
}
function perdida(criadoHaDias: number, atualizadoHaDias: number, motivoPerda: string | null): NegocioFechado {
  return { status: "perdida", motivoPerda, criadoEm: dias(criadoHaDias), faturadoEm: null, atualizadoEm: dias(atualizadoHaDias) };
}

describe("calcularLicoesVendas", () => {
  it("sem nenhuma negociação: só avisa amostra pequena, sem taxa nem motivos", () => {
    const r = calcularLicoesVendas([]);
    expect(r.totalFechadas).toBe(0);
    expect(r.taxaFechamentoPct).toBeNull();
    expect(r.diasMedioGanha).toBeNull();
    expect(r.diasMedioPerdida).toBeNull();
    expect(r.motivosPerda).toEqual([]);
    expect(r.linhas).toHaveLength(1);
    expect(r.linhas[0]).toContain("poucas negociações");
  });

  it("amostra pequena (abaixo do mínimo): avisa cautela mas ainda calcula a taxa", () => {
    const negocios = [ganha(20, 5), perdida(15, 10, "preco")];
    const r = calcularLicoesVendas(negocios);
    expect(r.totalFechadas).toBe(2);
    expect(r.linhas.some((l) => l.includes("poucas negociações"))).toBe(true);
    expect(r.taxaFechamentoPct).toBe(50);
  });

  it("calcula taxa de fechamento e identifica o motivo de perda mais comum", () => {
    const negocios: NegocioFechado[] = [
      ganha(30, 10), ganha(25, 8), ganha(20, 5), ganha(15, 3),
      perdida(30, 20, "preco"), perdida(28, 18, "preco"), perdida(25, 15, "preco"), perdida(20, 10, "concorrente"),
    ];
    const r = calcularLicoesVendas(negocios);
    expect(r.totalFechadas).toBe(8);
    expect(r.taxaFechamentoPct).toBe(50);
    expect(r.motivosPerda[0]).toEqual({ label: "Preço / condição", qtd: 3, pct: 75 });
    expect(r.linhas.some((l) => l.includes("Taxa de fechamento: 50%"))).toBe(true);
    expect(r.linhas.some((l) => l.includes("preço / condição"))).toBe(true);
    // Amostra >= mínimo: não deve haver aviso de cautela.
    expect(r.linhas.some((l) => l.includes("poucas negociações"))).toBe(false);
  });

  it("motivo com detalhe livre (id:nota) usa só o id para agrupar", () => {
    const negocios = [perdida(10, 5, "preco: tabela do concorrente bem abaixo"), perdida(10, 5, "preco"), ganha(10, 2), ganha(10, 2), ganha(10, 2)];
    const r = calcularLicoesVendas(negocios);
    expect(r.motivosPerda).toEqual([{ label: "Preço / condição", qtd: 2, pct: 100 }]);
  });

  it("motivo nulo/desconhecido cai em 'Não informado'/'Outro'", () => {
    const negocios = [perdida(10, 5, null), perdida(10, 5, "algo-inexistente")];
    const r = calcularLicoesVendas(negocios);
    const labels = r.motivosPerda.map((m) => m.label).sort();
    expect(labels).toEqual(["Não informado", "Outro"]);
  });

  it("perdidas muito mais lentas que ganhas: aponta o ponto em que a negociação esfria", () => {
    const negocios: NegocioFechado[] = [
      ganha(10, 8), ganha(12, 9), ganha(9, 7),
      perdida(40, 2, "adiou"), perdida(45, 3, "adiou"), perdida(50, 5, "sem_retorno"),
    ];
    const r = calcularLicoesVendas(negocios);
    expect(r.diasMedioGanha).toBe(2);
    expect(r.diasMedioPerdida).toBeGreaterThan(30);
    expect(r.linhas.some((l) => l.includes("tendem a esfriar"))).toBe(true);
  });

  it("ganhas e perdidas com tempo parecido: só informa a média, sem alerta de esfriamento", () => {
    const negocios: NegocioFechado[] = [
      ganha(20, 10), ganha(22, 12), ganha(18, 8),
      perdida(20, 11, "preco"), perdida(22, 13, "preco"), perdida(18, 9, "preco"),
    ];
    const r = calcularLicoesVendas(negocios);
    expect(r.linhas.some((l) => l.includes("tendem a esfriar"))).toBe(false);
    expect(r.linhas.some((l) => l.includes("Tempo médio até fechar"))).toBe(true);
  });

  it("motivo de perda raro (abaixo de 15%) não vira linha de destaque", () => {
    const motivos = ["preco", "preco", "preco", "preco", "preco", "preco", "concorrente"];
    const negocios = motivos.map((m) => perdida(10, 5, m));
    const r = calcularLicoesVendas(negocios);
    const concorrente = r.motivosPerda.find((m) => m.label === "Comprou do concorrente")!;
    expect(concorrente.pct).toBeLessThan(15);
    expect(r.linhas.some((l) => l.includes("comprou do concorrente"))).toBe(false);
  });
});
