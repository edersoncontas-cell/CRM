// "Durante os dias da semana, de segunda a sexta, quando tiver visitas
//  agendadas no CRM quero que você crie um pop up toda vez que entrar no CRM.
//  (…) O pop up vai começar aparecer ao entrar no crm exatamente no mesmo
//  horário que iniciou a primeira visita do dia, e só vai encerrar quando a
//  última visita do dia agendada foi marcada como visitada."
//
// O exemplo que ele deu, e que estes testes reproduzem: 9h com o cliente X,
// 10h45 com o Y, 11h50 com o Z e 16h com o W.

import { describe, it, expect } from "vitest";
import {
  estadoDoLembrete, emOrdemDeHorario, horarioDaPrimeira, escolherDaFila,
  ehDiaDeSemana, horaCurta, limitesDoDia, type VisitaDoDia,
} from "@/lib/visitas-do-dia";

// Quarta-feira, 23/09/2026. O "-03:00" é Brasília.
const em = (hhmm: string) => new Date(`2026-09-23T${hhmm}:00-03:00`);

const visita = (id: string, nome: string, hhmm: string, status = "agendada"): VisitaDoDia => ({
  id, clienteId: `c-${id}`, clienteNome: nome, data: em(hhmm), status, cidade: null, observacao: null,
});

const AGENDA = [
  visita("w", "Cliente W", "16:00"),
  visita("x", "Cliente X", "09:00"),
  visita("z", "Cliente Z", "11:50"),
  visita("y", "Cliente Y", "10:45"),
];

describe("a fila do dia", () => {
  it("é a ordem dos horários, não a ordem em que vieram do banco", () => {
    expect(emOrdemDeHorario(AGENDA).map((v) => v.clienteNome))
      .toEqual(["Cliente X", "Cliente Y", "Cliente Z", "Cliente W"]);
  });

  it("a primeira do dia é a das 9h", () => {
    expect(horaCurta(horarioDaPrimeira(AGENDA)!)).toBe("9h");
  });

  it("horário sem minuto sai curto; com minuto, completo", () => {
    expect(horaCurta(em("10:45"))).toBe("10h45");
    expect(horaCurta(em("16:00"))).toBe("16h");
  });
});

describe("quando o lembrete aparece", () => {
  it("antes da primeira visita, não aparece — ele ainda está indo", () => {
    const e = estadoDoLembrete(AGENDA, em("07:30"));
    expect(e.mostrar).toBe(false);
    expect(e.motivo).toBe("ainda_cedo");
  });

  it("no minuto exato da primeira visita, aparece", () => {
    expect(estadoDoLembrete(AGENDA, em("09:00")).mostrar).toBe(true);
  });

  it("e segue aparecendo o dia todo enquanto sobrar visita por sinalizar", () => {
    expect(estadoDoLembrete(AGENDA, em("14:00")).mostrar).toBe(true);
    expect(estadoDoLembrete(AGENDA, em("22:00")).mostrar).toBe(true);
  });

  it("sem visita no dia, não aparece", () => {
    const e = estadoDoLembrete([], em("10:00"));
    expect(e.mostrar).toBe(false);
    expect(e.motivo).toBe("sem_visitas");
  });

  it("sábado e domingo não geram lembrete", () => {
    const sabado = new Date("2026-09-26T10:00:00-03:00");
    const domingo = new Date("2026-09-27T10:00:00-03:00");
    expect(ehDiaDeSemana(sabado)).toBe(false);
    expect(ehDiaDeSemana(domingo)).toBe(false);
    expect(estadoDoLembrete(AGENDA, sabado).motivo).toBe("fim_de_semana");
  });

  it("segunda e sexta geram", () => {
    expect(ehDiaDeSemana(new Date("2026-09-21T10:00:00-03:00"))).toBe(true); // segunda
    expect(ehDiaDeSemana(new Date("2026-09-25T10:00:00-03:00"))).toBe(true); // sexta
  });
});

describe("quem é a vez", () => {
  it("é a mais antiga ainda pendente", () => {
    expect(estadoDoLembrete(AGENDA, em("12:00")).daVez?.clienteNome).toBe("Cliente X");
  });

  it("marcada a primeira, a vez passa para a seguinte", () => {
    const depois = AGENDA.map((v) => (v.id === "x" ? { ...v, status: "realizada" } : v));
    const e = estadoDoLembrete(depois, em("12:00"));
    expect(e.daVez?.clienteNome).toBe("Cliente Y");
    expect(e.sinalizadas).toBe(1);
    expect(e.total).toBe(4);
  });

  it("marcada fora de ordem, a vez continua sendo a mais antiga pendente", () => {
    // Ele atendeu o W (16h) primeiro. O X das 9h continua devendo resposta.
    const depois = AGENDA.map((v) => (v.id === "w" ? { ...v, status: "realizada" } : v));
    const e = estadoDoLembrete(depois, em("12:00"));
    expect(e.daVez?.clienteNome).toBe("Cliente X");
    expect(e.pendentes.map((p) => p.clienteNome)).toEqual(["Cliente X", "Cliente Y", "Cliente Z"]);
  });

  it("a visita não realizada também conta como sinalizada — ele já respondeu", () => {
    const depois = AGENDA.map((v) => (v.id === "x" ? { ...v, status: "nao_realizada" } : v));
    expect(estadoDoLembrete(depois, em("12:00")).daVez?.clienteNome).toBe("Cliente Y");
  });
});

describe("quando o lembrete encerra", () => {
  it("só quando NENHUMA do dia está pendente", () => {
    const tudoMarcado = AGENDA.map((v) => ({ ...v, status: "realizada" }));
    const e = estadoDoLembrete(tudoMarcado, em("17:00"));
    expect(e.mostrar).toBe(false);
    expect(e.motivo).toBe("tudo_sinalizado");
    expect(e.sinalizadas).toBe(4);
  });

  it("faltando uma, ainda aparece", () => {
    const quase = AGENDA.map((v) => (v.id === "w" ? v : { ...v, status: "realizada" }));
    expect(estadoDoLembrete(quase, em("17:00")).mostrar).toBe(true);
  });

  it("a primeira já marcada não adia a abertura para o horário da seguinte", () => {
    // Ele marcou a das 9h logo cedo. Às 9h30 o lembrete tem de continuar de pé
    // para a das 10h45 — o dia já começou.
    const depois = AGENDA.map((v) => (v.id === "x" ? { ...v, status: "realizada" } : v));
    expect(estadoDoLembrete(depois, em("09:30")).mostrar).toBe(true);
  });
});

describe("escolher outra visita da fila", () => {
  it("deixa pular para uma pendente — atendeu outro cliente primeiro", () => {
    expect(escolherDaFila(AGENDA, "z")?.clienteNome).toBe("Cliente Z");
  });

  it("não deixa escolher uma já sinalizada", () => {
    const depois = AGENDA.map((v) => (v.id === "z" ? { ...v, status: "realizada" } : v));
    expect(escolherDaFila(depois, "z")).toBeNull();
  });

  it("nem uma que não é do dia", () => {
    expect(escolherDaFila(AGENDA, "id-que-nao-existe")).toBeNull();
  });
});

describe("o dia de hoje é o dia de BRASÍLIA, não o do servidor", () => {
  it("21h de Brasília ainda é hoje, mesmo já sendo o dia seguinte em UTC", () => {
    // 23/09 21h em Brasília = 24/09 00h em UTC. Sem a conversão, a consulta
    // buscaria as visitas do dia errado.
    const { inicio, fim } = limitesDoDia(new Date("2026-09-24T00:30:00Z"));
    expect(inicio.toISOString()).toBe("2026-09-23T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-09-24T02:59:59.999Z");
  });
});
