// "deixa a opção de programar a postagem, com a data e a hora padrão horário
//  de brasilia."
//
// O risco aqui é todo de FUSO. O servidor roda em UTC e o vendedor vive em
// Brasília: "09:00" digitado por ele é 09:00 dele. Se o servidor interpretasse
// como UTC, a mensagem sairia às 6 da manhã — antes do cliente acordar, e sem
// nada na tela explicando.

import { describe, it, expect } from "vitest";
import {
  instanteDoEnvio, checarAgendamento, quandoPorExtenso, estaNaHora,
  hojeEmBrasilia, horaEmBrasilia, ANTECEDENCIA_MINIMA_MIN,
} from "@/lib/envio-programado";

describe("a hora que ele digita é a hora DELE", () => {
  it("09:00 de Brasília é 12:00 em UTC", () => {
    expect(instanteDoEnvio("2026-09-22", "09:00")!.toISOString()).toBe("2026-09-22T12:00:00.000Z");
  });

  it("e volta a ser 09:00 quando é lida de novo", () => {
    expect(quandoPorExtenso(new Date("2026-09-22T12:00:00.000Z"))).toBe("22/09/2026 às 09:00");
  });

  it("22h de Brasília ainda é o mesmo dia, mesmo já sendo o dia seguinte em UTC", () => {
    const d = instanteDoEnvio("2026-09-22", "22:00")!;
    expect(d.toISOString()).toBe("2026-09-23T01:00:00.000Z");
    expect(quandoPorExtenso(d)).toBe("22/09/2026 às 22:00");
  });

  it("data ou hora sem sentido devolve null, em vez de gravar lixo", () => {
    expect(instanteDoEnvio("22/09/2026", "09:00")).toBeNull();
    expect(instanteDoEnvio("2026-09-22", "9h")).toBeNull();
    expect(instanteDoEnvio("", "")).toBeNull();
  });
});

describe("o que dá e o que não dá para agendar", () => {
  const agora = new Date("2026-09-22T12:00:00.000Z"); // 09:00 em Brasília

  it("daqui a duas horas, dá", () => {
    const r = checarAgendamento("2026-09-22", "11:00", agora);
    expect(r.ok).toBe(true);
    if (r.ok) expect(quandoPorExtenso(r.quando)).toBe("22/09/2026 às 11:00");
  });

  it("horário que já passou, não dá — e a mensagem manda usar 'Enviar agora'", () => {
    const r = checarAgendamento("2026-09-22", "08:00", agora);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/Enviar agora/);
  });

  it("nem 'daqui a um minuto', que só geraria confusão", () => {
    const r = checarAgendamento("2026-09-22", "09:01", agora);
    expect(r.ok).toBe(false);
    expect(ANTECEDENCIA_MINIMA_MIN).toBe(2);
  });

  it("mais de um ano à frente é erro de digitação no ano, não intenção", () => {
    const r = checarAgendamento("2062-09-22", "09:00", agora);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/ano/);
  });

  it("data inválida tem mensagem própria", () => {
    const r = checarAgendamento("não é data", "09:00", agora);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/inválido/i);
  });
});

describe("o despachante só manda depois da hora, nunca antes", () => {
  const quando = new Date("2026-09-22T12:00:00.000Z");

  it("um minuto antes, não manda", () => {
    expect(estaNaHora(quando, new Date("2026-09-22T11:59:00.000Z"))).toBe(false);
  });

  it("no minuto exato, manda", () => {
    expect(estaNaHora(quando, quando)).toBe(true);
  });

  it("dez minutos depois (a passada seguinte do robô), manda", () => {
    expect(estaNaHora(quando, new Date("2026-09-22T12:10:00.000Z"))).toBe(true);
  });
});

describe("os valores que a tela abre", () => {
  it("o dia de hoje é o de Brasília, não o do servidor", () => {
    // 00h30 de 23/09 em UTC ainda é 21h30 de 22/09 em Brasília.
    expect(hojeEmBrasilia(new Date("2026-09-23T00:30:00.000Z"))).toBe("2026-09-22");
  });

  it("e a hora também", () => {
    expect(horaEmBrasilia(new Date("2026-09-23T00:30:00.000Z"))).toBe("21:30");
  });
});
