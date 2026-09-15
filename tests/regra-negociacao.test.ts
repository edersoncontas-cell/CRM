import { describe, expect, it } from "vitest";
import { deveAbrirNegociacao, motivoNaoAbrirNegociacao, type SinaisNegociacao } from "../src/lib/zeus/regra-negociacao";

const base: SinaisNegociacao = { intencao: "cotar", ehProspectReal: true, maquina: null, categoriaMaquina: null, condicaoPagamento: null, dataVisita: null };
const visita = new Date("2026-09-22T14:00:00Z");

describe("deveAbrirNegociacao (v3: máquina + pagamento ou visita)", () => {
  it("valor solto sem máquina NÃO abre (o caso do card fantasma no funil)", () => {
    expect(motivoNaoAbrirNegociacao({ ...base, condicaoPagamento: "financiado" })).toBe("sem_maquina");
  });

  it("máquina sozinha ainda não abre — falta pagamento ou visita", () => {
    expect(motivoNaoAbrirNegociacao({ ...base, categoriaMaquina: "retroescavadeira" })).toBe("sem_pagamento_nem_visita");
    expect(motivoNaoAbrirNegociacao({ ...base, maquina: "B110C" })).toBe("sem_pagamento_nem_visita");
  });

  it("abre com categoria ou modelo + condição de pagamento", () => {
    expect(deveAbrirNegociacao({ ...base, categoriaMaquina: "mini escavadeira", condicaoPagamento: "à vista" })).toBe(true);
    expect(deveAbrirNegociacao({ ...base, intencao: "comprar", maquina: "E145", condicaoPagamento: "consórcio" })).toBe(true);
  });

  it("abre com máquina + visita agendada, mesmo sem falar de pagamento", () => {
    expect(deveAbrirNegociacao({ ...base, categoriaMaquina: "motoniveladora", dataVisita: visita })).toBe(true);
  });

  it("suporte/outro e não-prospect nunca abrem, mesmo com tudo levantado", () => {
    const completo = { ...base, maquina: "B110C", condicaoPagamento: "financiado", dataVisita: visita };
    expect(motivoNaoAbrirNegociacao({ ...completo, intencao: "suporte" })).toBe("suporte_ou_outro");
    expect(motivoNaoAbrirNegociacao({ ...completo, intencao: "outro" })).toBe("suporte_ou_outro");
    expect(motivoNaoAbrirNegociacao({ ...completo, ehProspectReal: false })).toBe("nao_e_prospect");
  });

  it("curiosidade só abre se já tem visita", () => {
    expect(motivoNaoAbrirNegociacao({ ...base, intencao: "curiosidade", maquina: "B110C", condicaoPagamento: "à vista" })).toBe("so_curiosidade");
    expect(deveAbrirNegociacao({ ...base, intencao: "curiosidade", maquina: "B110C", dataVisita: visita })).toBe(true);
  });

  it("strings em branco contam como ausentes", () => {
    expect(motivoNaoAbrirNegociacao({ ...base, maquina: "  ", categoriaMaquina: "", condicaoPagamento: "financiado" })).toBe("sem_maquina");
    expect(motivoNaoAbrirNegociacao({ ...base, maquina: "B110C", condicaoPagamento: "   " })).toBe("sem_pagamento_nem_visita");
  });
});
