// "Na minha agenda o evento da Paving Expo do dia 22 a 25 está correto, porém
//  no Dashboard está acusando até o sábado. Corrija isso e não deixe que
//  aconteça novamente."
//
// A feira ia de 22 a 25 de setembro. O calendário da página de Visitas
// mostrava 22, 23, 24 e 25 — certo. O Dashboard mostrava 22, 23, 24, 25 E 26.
// Mesma agenda, mesmo evento, duas telas, dois resultados.
//
// A causa é a mais clássica de todas: DUAS CONTAS diferentes para a mesma
// pergunta, "que dia é este?".
//
//   • O calendário usava diaIso(), que formata no fuso de Brasília.
//   • O Dashboard usava date.getDate(), que responde no fuso do SERVIDOR.
//
// E o servidor da Vercel roda em UTC. Um evento que termina 25/09 às 23:59 de
// Brasília é 26/09 às 02:59 em UTC — então getDate() respondia 26, e o laço
// do Dashboard ia até sábado.
//
// É POR ISSO QUE ESTE ARQUIVO FORÇA process.env.TZ = "UTC": rodando o teste
// no fuso de Brasília o defeito simplesmente não aparece, e foi assim que ele
// passou despercebido. Em UTC ele aparece na hora.
//
// O "não deixe acontecer de novo" é estrutural: só existe UMA conta agora
// (diaIso / diasDoEvento / diaDoMesBrasilia, em lib/eventos-agenda.ts), e o
// Dashboard passou a usar a mesma do calendário.

process.env.TZ = "UTC";

import { describe, it, expect } from "vitest";
import { diaIso, diasDoEvento, diaDoMesBrasilia, mesBrasilia } from "@/lib/eventos-agenda";

// O evento real: 22/09/2026 00:00 a 25/09/2026 23:59, horário de Brasília.
const INICIO = new Date("2026-09-22T00:00:00-03:00");
const FIM = new Date("2026-09-25T23:59:00-03:00");

describe("o fuso em que o teste roda", () => {
  it("é UTC — sem isso o defeito não aparece", () => {
    expect(new Date().getTimezoneOffset()).toBe(0);
  });

  it("e em UTC o fim da feira CAI NO DIA SEGUINTE — a origem do bug", () => {
    // Esta é a linha que explica tudo: getDate() diz 26.
    expect(FIM.getUTCDate()).toBe(26);
  });
});

describe("a Paving Expo de 22 a 25", () => {
  it("diaIso devolve o dia de Brasília, não o do servidor", () => {
    expect(diaIso(INICIO)).toBe("2026-09-22");
    expect(diaIso(FIM)).toBe("2026-09-25"); // <- 25, não 26
  });

  it("ocupa EXATAMENTE quatro dias: 22, 23, 24 e 25", () => {
    const dias = diasDoEvento(diaIso(INICIO), diaIso(FIM));
    expect(dias).toEqual(["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"]);
  });

  it("NÃO encosta no sábado 26 — era o que o Dashboard mostrava", () => {
    expect(diasDoEvento(diaIso(INICIO), diaIso(FIM))).not.toContain("2026-09-26");
  });

  it("o dia do mês sai certo pelo helper compartilhado", () => {
    expect(diaDoMesBrasilia(INICIO)).toBe(22);
    expect(diaDoMesBrasilia(FIM)).toBe(25); // getDate() diria 26
    expect(mesBrasilia(FIM)).toBe(9);
  });
});

describe("a mesma armadilha em outras horas do dia", () => {
  it("visita das 21h fica no dia dela, não no seguinte", () => {
    // 21h de Brasília é meia-noite do dia seguinte em UTC. O Dashboard
    // agrupava por getDate(), então a visita pulava de quadradinho.
    const visita21h = new Date("2026-09-25T21:00:00-03:00");
    expect(visita21h.getUTCDate()).toBe(26);   // o que o servidor via
    expect(diaDoMesBrasilia(visita21h)).toBe(25); // o que o vendedor vê
  });

  it("visita da meia-noite também", () => {
    const meiaNoite = new Date("2026-09-25T00:00:00-03:00");
    expect(diaDoMesBrasilia(meiaNoite)).toBe(25);
  });

  it("evento de um dia só ocupa um dia", () => {
    const d = new Date("2026-09-22T23:59:00-03:00");
    expect(diasDoEvento(diaIso(d), diaIso(d))).toEqual(["2026-09-22"]);
  });

  it("evento que atravessa a virada do mês não se perde", () => {
    const ini = new Date("2026-09-29T00:00:00-03:00");
    const fim = new Date("2026-10-02T23:59:00-03:00");
    expect(diasDoEvento(diaIso(ini), diaIso(fim)))
      .toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });

  it("evento que atravessa a virada do ano também", () => {
    const ini = new Date("2026-12-30T00:00:00-03:00");
    const fim = new Date("2027-01-02T23:59:00-03:00");
    expect(diasDoEvento(diaIso(ini), diaIso(fim)))
      .toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
});
