import { describe, it, expect } from "vitest";
import { calcular, calcPadrao, textoRetorno, normalizarDados, type DadosProposta } from "@/lib/proposta";

function cenario() {
  const c = calcPadrao();
  c.horasMes = 200;
  c.dieselLitro = 6;
  c.diariaCobertura = 1000;
  c.atual = { rotulo: "Retro 2011", valor: 0, parcelaMes: 0, consumoLh: 8, manutencaoMes: 4000, diasParadosMes: 3, revendaPct: 0 };
  c.nova = { rotulo: "B95C", valor: 500_000, parcelaMes: 8_000, consumoLh: 5, manutencaoMes: 800, diasParadosMes: 0, revendaPct: 50 };
  c.concorrente = { rotulo: "Concorrente", valor: 520_000, parcelaMes: 8_300, consumoLh: 6, manutencaoMes: 1200, diasParadosMes: 1, revendaPct: 45 };
  return c;
}

describe("calculadora de custo por hora e TCO", () => {
  const r = calcular(cenario());

  it("custo operacional mensal = diesel + manutenção + paradas", () => {
    // atual: 8 L/h × 200 h × R$6 = 9.600 + 4.000 + 3 dias × 1.000 = 16.600
    expect(r.atual.custoMensalOperacional).toBe(16_600);
    // nova: 5 × 200 × 6 = 6.000 + 800 + 0 = 6.800
    expect(r.nova.custoMensalOperacional).toBe(6_800);
  });

  it("horas efetivas descontam 8h por dia parado", () => {
    expect(r.atual.horasEfetivas).toBe(200 - 3 * 8);
    expect(r.nova.horasEfetivas).toBe(200);
  });

  it("custo por hora inclui a parcela", () => {
    expect(r.nova.custoHora).toBeCloseTo((6_800 + 8_000) / 200, 5);
  });

  it("economia, diferença total e payback", () => {
    expect(r.economiaOperacionalMes).toBe(9_800);
    expect(r.diferencaTotalMes).toBe(14_800 - 16_600);
    expect(r.paybackMeses).toBe(Math.ceil(500_000 / 9_800));
  });

  it("TCO em 5 anos com revenda", () => {
    // 500.000 + 6.800 × 60 − 250.000 = 658.000
    expect(r.nova.tcoTotal).toBe(658_000);
    expect(r.tcoDiferencaConcorrente).not.toBeNull();
    expect(r.patrimonioAoFim).toBe(250_000);
  });

  it("texto de retorno cita custo por hora e economia", () => {
    const t = textoRetorno(cenario(), r);
    expect(t).toContain("Custo por hora hoje");
    expect(t).toContain("Economia operacional");
    expect(t).toContain("Custo total em 5 anos");
  });

  it("sem economia não há payback", () => {
    const c = cenario();
    c.nova.consumoLh = 12;
    c.nova.manutencaoMes = 9_000;
    expect(calcular(c).paybackMeses).toBeNull();
  });
});

describe("normalizarDados", () => {
  const base: DadosProposta = {
    titulo: "Proposta", situacaoAtual: "", solucao: "", retorno: "",
    condicao: { valor: 0, entradaValor: 0, usadaDescricao: "", instrumento: "Finame", parcelas: 48, parcelaValor: 0, carenciaDias: 0, entregaDias: 30, garantiaMeses: 12, inclusos: "" },
    prova: "", validade: "2026-12-31", proximoPasso: "", calc: calcPadrao(),
  };
  it("preenche campos faltantes e rejeita lixo", () => {
    expect(normalizarDados(null, base)).toBe(base);
    const n = normalizarDados({ titulo: "X", condicao: { parcelas: 60 } }, base);
    expect(n.titulo).toBe("X");
    expect(n.condicao.parcelas).toBe(60);
    expect(n.condicao.instrumento).toBe("Finame");
    expect(n.calc.horasMes).toBe(base.calc.horasMes);
  });
});
