// "Quero que no cadastro do cliente tenha o registro de quantas visitas ele
//  teve, em que dia, mês e ano, e a quantidade de dias desde a última visita."
//
// Duas contas que parecem uma e não são: "visitas que ele TEVE" são as que
// aconteceram, e a conta dos dias sai da última que aconteceu. Contar as
// agendadas daria "faz -3 dias"; contar as não realizadas mentiria dizendo que
// o cliente foi atendido.

import { describe, it, expect } from "vitest";
import { resumoDeVisitas, textoDiasDesde, dataDaVisita, diasEntre, visitasPorAno, type VisitaHistorico } from "@/lib/visitas-historico";

const HOJE = new Date("2026-09-23T14:00:00-03:00");
const v = (id: string, iso: string, status: string): VisitaHistorico => ({ id, data: new Date(iso), status, observacao: null });

const HISTORICO = [
  v("1", "2025-03-11T09:00:00-03:00", "realizada"),
  v("2", "2025-08-02T14:00:00-03:00", "realizada"),
  v("3", "2026-09-01T10:00:00-03:00", "realizada"),
  v("4", "2026-09-15T10:00:00-03:00", "nao_realizada"),
  v("5", "2026-10-02T09:00:00-03:00", "agendada"),
];

describe("quantas visitas ele teve", () => {
  it("conta só as que aconteceram", () => {
    const r = resumoDeVisitas(HISTORICO, HOJE);
    expect(r.realizadas).toBe(3);
    expect(r.agendadas).toBe(1);
    expect(r.naoRealizadas).toBe(1);
  });

  it("cliente sem visita nenhuma não quebra a conta", () => {
    const r = resumoDeVisitas([], HOJE);
    expect(r.realizadas).toBe(0);
    expect(r.ultima).toBeNull();
    expect(r.diasDesdeUltima).toBeNull();
    expect(textoDiasDesde(r.diasDesdeUltima)).toBe("nunca visitado");
  });

  it("cliente que só tem visita agendada ainda não foi visitado", () => {
    const r = resumoDeVisitas([v("a", "2026-10-02T09:00:00-03:00", "agendada")], HOJE);
    expect(r.realizadas).toBe(0);
    expect(r.diasDesdeUltima).toBeNull();
  });
});

describe("dias desde a última visita", () => {
  it("sai da última REALIZADA, ignorando a não realizada mais recente", () => {
    const r = resumoDeVisitas(HISTORICO, HOJE);
    expect(dataDaVisita(r.ultima!)).toBe("01/09/2026");
    expect(r.diasDesdeUltima).toBe(22);
  });

  it("a lista fora de ordem dá o mesmo resultado", () => {
    const embaralhado = [HISTORICO[2], HISTORICO[0], HISTORICO[4], HISTORICO[1], HISTORICO[3]];
    expect(resumoDeVisitas(embaralhado, HOJE).diasDesdeUltima).toBe(22);
  });

  it("conta DIAS DE CALENDÁRIO, não horas", () => {
    // Visita ontem às 17h, agora são 9h da manhã: 16 horas de diferença, mas a
    // resposta certa é "1 dia" — é assim que o vendedor conta.
    const ontem17h = new Date("2026-09-22T17:00:00-03:00");
    const hoje9h = new Date("2026-09-23T09:00:00-03:00");
    expect(diasEntre(ontem17h, hoje9h)).toBe(1);
  });

  it("visita de hoje dá zero, nunca negativo", () => {
    const r = resumoDeVisitas([v("a", "2026-09-23T09:00:00-03:00", "realizada")], HOJE);
    expect(r.diasDesdeUltima).toBe(0);
    expect(textoDiasDesde(0)).toBe("hoje");
  });
});

describe("a próxima agendada", () => {
  it("é a mais próxima no futuro, não a mais distante", () => {
    const comDuas = [...HISTORICO, v("6", "2026-09-25T09:00:00-03:00", "agendada")];
    expect(dataDaVisita(resumoDeVisitas(comDuas, HOJE).proxima!)).toBe("25/09/2026");
  });

  it("agendada que já passou não conta como próxima", () => {
    const so = [v("a", "2026-09-01T09:00:00-03:00", "agendada")];
    expect(resumoDeVisitas(so, HOJE).proxima).toBeNull();
  });
});

describe("como o vendedor lê o tempo", () => {
  it("fala em dias, meses e anos — não em número cru", () => {
    expect(textoDiasDesde(1)).toBe("ontem");
    expect(textoDiasDesde(12)).toBe("faz 12 dias");
    expect(textoDiasDesde(29)).toBe("faz 29 dias");
    expect(textoDiasDesde(60)).toBe("faz 2 meses");
    expect(textoDiasDesde(365)).toBe("faz 1 ano");
    expect(textoDiasDesde(400)).toBe("faz 1a 1m");
  });
});

describe("as visitas agrupadas por ano", () => {
  it("do ano mais recente para o mais antigo, e dentro do ano da mais nova para a mais velha", () => {
    const grupos = visitasPorAno(HISTORICO);
    expect(grupos.map((g) => g.ano)).toEqual([2026, 2025]);
    expect(grupos[0].visitas.map((x) => dataDaVisita(x.data))).toEqual(["02/10/2026", "15/09/2026", "01/09/2026"]);
    expect(grupos[1].visitas.map((x) => dataDaVisita(x.data))).toEqual(["02/08/2025", "11/03/2025"]);
  });

  it("dia, mês e ano — o formato que ele pediu", () => {
    expect(dataDaVisita(new Date("2026-03-07T10:00:00-03:00"))).toBe("07/03/2026");
  });
});
