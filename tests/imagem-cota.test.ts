// A criação de arte roda na camada GRATUITA da API do Gemini, e vai continuar
// rodando assim — o dono do CRM não quer assinar nada a mais.
//
// O problema não era a cota existir, era o CRM desperdiçá-la: quando o teto do
// dia estourava, cada clique em "Criar a arte" ainda tentava os dois modelos,
// tomava 429 nos dois, e a tela só sabia dizer "espere um minuto". O vendedor
// clicava de novo, e de novo.
//
// Estas regras fazem o CRM lembrar do que já acabou, não gastar chamada à toa,
// e dizer na tela a hora certa em que a arte volta.

import { describe, it, expect, beforeEach } from "vitest";
import {
  marcarEsgotado, esgotadoAte, modelosDisponiveis, primeiraLiberacao,
  proximaViradaDiariaGoogle, quandoVolta, zerarCota,
} from "@/lib/ai/imagem-cota";

const MODELOS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"];
const agora = new Date("2026-09-20T15:00:00Z");

beforeEach(() => zerarCota());

describe("memória do que acabou", () => {
  it("modelo marcado sai da fila; o outro continua", () => {
    marcarEsgotado(MODELOS[0], new Date(agora.getTime() + 3600_000));
    expect(modelosDisponiveis(MODELOS, agora)).toEqual([MODELOS[1]]);
  });

  it("cada modelo tem a SUA cota — é isso que estica o plano gratuito", () => {
    marcarEsgotado(MODELOS[0], new Date(agora.getTime() + 3600_000));
    expect(esgotadoAte(MODELOS[0], agora)).not.toBe(null);
    expect(esgotadoAte(MODELOS[1], agora)).toBe(null);
  });

  it("passado o horário, o modelo volta sozinho", () => {
    marcarEsgotado(MODELOS[0], new Date(agora.getTime() + 60_000));
    expect(modelosDisponiveis(MODELOS, agora)).toEqual([MODELOS[1]]);
    const depois = new Date(agora.getTime() + 120_000);
    expect(modelosDisponiveis(MODELOS, depois)).toEqual(MODELOS);
  });

  it("uma espera curta não encurta uma longa já marcada", () => {
    // O teto do DIA já bateu; um 429 de minuto chegando depois não pode fazer
    // o CRM voltar a tentar em 30 segundos.
    const amanha = new Date(agora.getTime() + 8 * 3600_000);
    marcarEsgotado(MODELOS[0], amanha);
    marcarEsgotado(MODELOS[0], new Date(agora.getTime() + 30_000));
    expect(esgotadoAte(MODELOS[0], agora)?.getTime()).toBe(amanha.getTime());
  });

  it("nada marcado, tudo disponível", () => {
    expect(modelosDisponiveis(MODELOS, agora)).toEqual(MODELOS);
    expect(primeiraLiberacao(MODELOS, agora)).toBe(null);
  });

  it("com os dois fora, sabe qual volta primeiro", () => {
    marcarEsgotado(MODELOS[0], new Date(agora.getTime() + 7200_000));
    marcarEsgotado(MODELOS[1], new Date(agora.getTime() + 600_000));
    expect(modelosDisponiveis(MODELOS, agora)).toEqual([]);
    expect(primeiraLiberacao(MODELOS, agora)?.getTime()).toBe(agora.getTime() + 600_000);
  });
});

describe("virada da cota diária do Google", () => {
  it("é sempre no futuro e dentro de 24h", () => {
    for (const iso of ["2026-09-20T15:00:00Z", "2026-09-20T06:30:00Z", "2026-01-15T23:59:00Z", "2026-07-04T07:00:00Z"]) {
      const t = new Date(iso);
      const v = proximaViradaDiariaGoogle(t);
      expect(v.getTime()).toBeGreaterThan(t.getTime());
      expect(v.getTime() - t.getTime()).toBeLessThanOrEqual(86_400_000);
    }
  });

  it("cai na meia-noite do Pacífico, não na daqui", () => {
    // A cota do Google vira em PT. Dizer "volta amanhã" para quem está em
    // Brasília erraria por horas: boa parte do dia, a virada do Pacífico ainda
    // cai hoje à noite no horário brasileiro.
    const v = proximaViradaDiariaGoogle(new Date("2026-09-20T15:00:00Z"));
    const hPT = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "2-digit", hour12: false }).format(v);
    expect(Number(hPT) % 24).toBe(0);
  });
});

describe("como a hora é dita na tela", () => {
  it("minutos, quando é logo ali", () => {
    expect(quandoVolta(new Date(agora.getTime() + 21 * 60_000), agora)).toBe("em 21 minutos");
  });

  it('"em instantes" quando já está vencendo', () => {
    expect(quandoVolta(new Date(agora.getTime() + 20_000), agora)).toBe("em instantes");
  });

  it("hoje × amanhã pelo calendário de Brasília", () => {
    // 15:00Z = 12:00 em Brasília. +4h ainda é hoje; +16h já é amanhã.
    expect(quandoVolta(new Date(agora.getTime() + 4 * 3600_000), agora)).toMatch(/^hoje às /);
    expect(quandoVolta(new Date(agora.getTime() + 16 * 3600_000), agora)).toMatch(/^amanhã às /);
  });
});
