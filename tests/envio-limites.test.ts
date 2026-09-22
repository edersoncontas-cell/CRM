// TRAVAS DE ENVIO.
//
// Escrito depois de a Meta restringir o WhatsApp do vendedor por 24h.
//
// O risco destes testes é o oposto do normal: aqui uma regra FROUXA custa o
// número, e uma regra APERTADA demais custa venda. Os dois lados são testados.

import { describe, it, expect } from "vitest";
import {
  porQueNaoEnviar, podeEnviarAgora, restamHoje, explicarBloqueio, pausaHumanaMs,
  comRodapeDeSaida, ehPedidoDeSaida, motivosDeFora, horaBrasilia, diaBrasilia, diaSemanaBrasilia,
  LIMITES_PADRAO,
} from "@/lib/envio-limites";

// Segunda-feira, 21/09/2026.
const segunda = (h: number) => new Date(`2026-09-21T${String(h).padStart(2, "0")}:00:00-03:00`);
const sabado = (h: number) => new Date(`2026-09-26T${String(h).padStart(2, "0")}:00:00-03:00`);
const domingo = (h: number) => new Date(`2026-09-27T${String(h).padStart(2, "0")}:00:00-03:00`);

describe("o fuso é o do vendedor, não o do servidor", () => {
  it("21h de Brasília ainda é o mesmo dia, mesmo já sendo o dia seguinte em UTC", () => {
    const d = new Date("2026-09-21T21:00:00-03:00"); // 00:00 de 22/09 em UTC
    expect(diaBrasilia(d)).toBe("2026-09-21");
    expect(horaBrasilia(d)).toBe(21);
  });

  it("reconhece o dia da semana em Brasília", () => {
    expect(diaSemanaBrasilia(segunda(10))).toBe(1);
    expect(diaSemanaBrasilia(sabado(10))).toBe(6);
    expect(diaSemanaBrasilia(domingo(10))).toBe(0);
  });
});

describe("a janela de horário", () => {
  it("em horário comercial, dia útil, pode", () => {
    expect(porQueNaoEnviar(segunda(9), 0)).toBeNull();
    expect(podeEnviarAgora(segunda(14), 10)).toBe(true);
  });

  it("de madrugada não sai — é assinatura de robô", () => {
    expect(porQueNaoEnviar(segunda(3), 0)).toBe("fora_do_horario");
    expect(porQueNaoEnviar(segunda(23), 0)).toBe("fora_do_horario");
  });

  it("as bordas: 8h entra, 18h já não", () => {
    expect(porQueNaoEnviar(segunda(8), 0)).toBeNull();
    expect(porQueNaoEnviar(segunda(17), 0)).toBeNull();
    expect(porQueNaoEnviar(segunda(18), 0)).toBe("fora_do_horario");
  });

  it("fim de semana não dispara", () => {
    expect(porQueNaoEnviar(sabado(10), 0)).toBe("fim_de_semana");
    expect(porQueNaoEnviar(domingo(10), 0)).toBe("fim_de_semana");
  });

  it("quem desliga a trava de dia útil consegue mandar no sábado", () => {
    expect(porQueNaoEnviar(sabado(10), 0, { ...LIMITES_PADRAO, somenteDiasUteis: false })).toBeNull();
  });
});

describe("o teto do dia", () => {
  it("segura no número exato", () => {
    expect(porQueNaoEnviar(segunda(10), 79)).toBeNull();
    expect(porQueNaoEnviar(segunda(10), 80)).toBe("teto_diario");
    expect(porQueNaoEnviar(segunda(10), 500)).toBe("teto_diario");
  });

  it("o padrão é 80, e é baixo de propósito", () => {
    expect(LIMITES_PADRAO.tetoDiario).toBe(80);
  });

  it("diz quantas ainda cabem, e nunca devolve negativo", () => {
    expect(restamHoje(0)).toBe(80);
    expect(restamHoje(75)).toBe(5);
    expect(restamHoje(200)).toBe(0);
  });

  it("dá para apertar o teto sem deploy, quando a Meta apertar", () => {
    expect(porQueNaoEnviar(segunda(10), 30, { ...LIMITES_PADRAO, tetoDiario: 30 })).toBe("teto_diario");
  });
});

describe("o motivo é explicado, nunca só negado", () => {
  it("cada bloqueio tem um texto que o vendedor entende", () => {
    expect(explicarBloqueio("fim_de_semana")).toMatch(/fim de semana/i);
    expect(explicarBloqueio("fora_do_horario")).toMatch(/8h às 18h/);
    expect(explicarBloqueio("teto_diario")).toMatch(/80/);
    expect(explicarBloqueio(null)).toBe("");
  });
});

describe("o ritmo parece gente", () => {
  it("fica dentro da faixa configurada", () => {
    expect(pausaHumanaMs(LIMITES_PADRAO, 0)).toBe(12_000);
    expect(pausaHumanaMs(LIMITES_PADRAO, 1)).toBe(25_000);
    expect(pausaHumanaMs(LIMITES_PADRAO, 0.5)).toBe(18_500);
  });

  it("é MUITO mais lento que os 0,7s que causaram o bloqueio", () => {
    expect(pausaHumanaMs(LIMITES_PADRAO, 0)).toBeGreaterThan(10 * 700);
  });

  it("sorteio fora da faixa não quebra o ritmo", () => {
    expect(pausaHumanaMs(LIMITES_PADRAO, -5)).toBe(12_000);
    expect(pausaHumanaMs(LIMITES_PADRAO, 99)).toBe(25_000);
  });
});

describe("o rodapé de saída", () => {
  it("é colado na mensagem", () => {
    expect(comRodapeDeSaida("Chegou a Paving Expo!")).toMatch(/responda SAIR/);
  });

  it("não duplica quando o vendedor já escreveu a saída", () => {
    const t = "Promoção! Se não quiser mais, responda SAIR.";
    expect(comRodapeDeSaida(t)).toBe(t);
  });
});

describe("reconhecer quem pediu para parar", () => {
  it("as formas que o cliente realmente escreve", () => {
    for (const t of ["SAIR", "sair", "Pare", "parar", "não quero mais", "me tira dessa lista", "descadastrar", "STOP", "cancelar"]) {
      expect(ehPedidoDeSaida(t), t).toBe(true);
    }
  });

  it("acento e pontuação não atrapalham", () => {
    expect(ehPedidoDeSaida("Não quero!")).toBe(true);
    expect(ehPedidoDeSaida("nao quero.")).toBe(true);
  });

  it("frases inequívocas valem em qualquer tamanho", () => {
    for (const t of [
      "por favor, pare de mandar essas mensagens toda semana",
      "bom dia, não quero mais receber promoção, obrigado",
      "me tira dessa lista aí por gentileza",
      "quero sair da lista de mensagens",
      "não me mande mais nada disso",
    ]) {
      expect(ehPedidoDeSaida(t), t).toBe(true);
    }
  });

  it("NÃO confunde conversa normal com pedido de saída", () => {
    // O erro caro deste módulo: cliente ativo marcado como não-perturbe some
    // das campanhas e ninguém percebe.
    for (const t of [
      "vou sair para almoçar, te retorno",
      "pode parar na frente do galpão quando chegar",
      "quero sim, me manda a proposta",
      "vou sair do sítio agora e passo aí para ver a máquina, me espera",
      "pode remover aquele item da proposta?",
      "vou cancelar a visita de quinta, pode ser sexta?",
      "para de brincadeira, esse preço tá bom demais",
    ]) {
      expect(ehPedidoDeSaida(t), t).toBe(false);
    }
  });

  it("palavra solta no meio de texto longo não vale", () => {
    expect(ehPedidoDeSaida("bom dia! " + "x".repeat(80) + " sair")).toBe(false);
  });

  it("vazio não é pedido de saída", () => {
    expect(ehPedidoDeSaida("")).toBe(false);
    expect(ehPedidoDeSaida(null)).toBe(false);
    expect(ehPedidoDeSaida(undefined)).toBe(false);
  });
});

describe("motivosDeFora", () => {
  it("concorda o verbo com o número", () => {
    expect(motivosDeFora({ frios: 1, pediramSaida: 0, semTelefone: 0 })).toBe("1 que nunca falou com você");
    expect(motivosDeFora({ frios: 2, pediramSaida: 0, semTelefone: 0 })).toBe("2 que nunca falaram com você");
    expect(motivosDeFora({ frios: 0, pediramSaida: 1, semTelefone: 0 })).toBe("1 que pediu para sair");
    expect(motivosDeFora({ frios: 0, pediramSaida: 3, semTelefone: 0 })).toBe("3 que pediram para sair");
  });

  it("junta os motivos que existem e omite os zerados", () => {
    expect(motivosDeFora({ frios: 1290, pediramSaida: 1, semTelefone: 4 }))
      .toBe("1290 que nunca falaram com você, 1 que pediu para sair, 4 sem telefone");
    expect(motivosDeFora({ frios: 0, pediramSaida: 0, semTelefone: 0 })).toBe("");
  });
});
