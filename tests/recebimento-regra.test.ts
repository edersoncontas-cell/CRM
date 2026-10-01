import { describe, it, expect } from "vitest";
import { minutosUteisEntre, situacaoRecebimento, quando, HORAS_UTEIS_SEM_NADA } from "../src/lib/recebimento-regra";

// 01/10/2026, quinta, 15:00 em Brasília (18:00 UTC).
const agora = Date.parse("2026-10-01T18:00:00Z");
const h = (horas: number) => new Date(agora - horas * 3_600_000).toISOString();
const base = { configurado: true, conectado: true, agora };

describe("minutosUteisEntre (07h–20h de Brasília)", () => {
  it("conta só o expediente", () => {
    // 05:00 → 09:00 de Brasília: só 07:00–09:00 conta.
    expect(minutosUteisEntre(Date.parse("2026-10-01T08:00:00Z"), Date.parse("2026-10-01T12:00:00Z"))).toBe(120);
  });

  it("a noite não conta: das 20h às 07h do dia seguinte dá zero", () => {
    expect(minutosUteisEntre(Date.parse("2026-10-01T23:00:00Z"), Date.parse("2026-10-02T10:00:00Z"))).toBe(0);
  });

  it("atravessa dias", () => {
    // 19:00 de um dia até 08:00 do outro: 1 h + 1 h.
    expect(minutosUteisEntre(Date.parse("2026-10-01T22:00:00Z"), Date.parse("2026-10-02T11:00:00Z"))).toBe(120);
  });

  it("intervalo invertido ou vazio é zero", () => {
    expect(minutosUteisEntre(agora, agora)).toBe(0);
    expect(minutosUteisEntre(agora, agora - 1000)).toBe(0);
  });
});

describe("situacaoRecebimento", () => {
  it("desconectado ou sem WhatsApp: o topo já diz, aqui não repete", () => {
    expect(situacaoRecebimento({ ...base, conectado: false, ultimaChamada: h(1), ultimoStatus: "recebida" })).toBeNull();
    expect(situacaoRecebimento({ ...base, configurado: false, conectado: false, ultimaChamada: null, ultimoStatus: null })).toBeNull();
  });

  it("chegando: mostra quando foi a última, sem aviso", () => {
    const s = situacaoRecebimento({ ...base, ultimaChamada: h(0.5), ultimoStatus: "recebida" });
    expect(s?.nivel).toBe("ok");
    expect(s?.aviso).toBeNull();
    expect(s?.curto).toBe("recebida 14:30");
    expect(s?.extenso).toBe("Última mensagem do WhatsApp recebida hoje às 14:30");
  });

  it("pareado e nada chegou ainda a este banco: avisa", () => {
    const s = situacaoRecebimento({ ...base, ultimaChamada: null, ultimoStatus: null });
    expect(s?.nivel).toBe("atencao");
    expect(s?.aviso).toMatch(/Nenhuma mensagem do WhatsApp chegou a este banco/);
  });

  it(`${HORAS_UTEIS_SEM_NADA} h de expediente sem nada: avisa, dizendo desde quando`, () => {
    const s = situacaoRecebimento({ ...base, ultimaChamada: h(3.5), ultimoStatus: "recebida" });
    expect(s?.nivel).toBe("atencao");
    expect(s?.aviso).toMatch(/desde hoje às 11:30/);
  });

  it("a noite sem mensagem não vira alarme de manhã cedo", () => {
    // Última às 20:30 de ontem; agora 08:00 → 1 h de expediente só.
    const s = situacaoRecebimento({
      ...base, agora: Date.parse("2026-10-02T11:00:00Z"),
      ultimaChamada: "2026-10-01T23:30:00Z", ultimoStatus: "recebida",
    });
    expect(s?.nivel).toBe("ok");
    expect(s?.curto).toBe("recebida ontem");
  });

  it("depois da volta para o Neon: última chamada de 23/09 avisa", () => {
    const s = situacaoRecebimento({ ...base, ultimaChamada: "2026-09-23T14:00:00Z", ultimoStatus: "recebida" });
    expect(s?.nivel).toBe("atencao");
    expect(s?.curto).toBe("nada desde 23/09");
    expect(s?.aviso).toMatch(/desde 23\/09 às 11:00 \(há 8 dias\)\./);
  });

  it("chave recusada é falha, mesmo recente", () => {
    const s = situacaoRecebimento({ ...base, ultimaChamada: h(0.1), ultimoStatus: "chave-recusada" });
    expect(s?.nivel).toBe("falha");
    expect(s?.aviso).toMatch(/recusada/);
  });

  it("erro ao gravar é falha e diz o erro", () => {
    const s = situacaoRecebimento({ ...base, ultimaChamada: h(0.1), ultimoStatus: "erro:PrismaClientKnownRequestError" });
    expect(s?.nivel).toBe("falha");
    expect(s?.aviso).toMatch(/PrismaClientKnownRequestError/);
  });

  it("data ilegível conta como nada recebido, não como tudo certo", () => {
    const s = situacaoRecebimento({ ...base, ultimaChamada: "lixo", ultimoStatus: "recebida" });
    expect(s?.nivel).toBe("atencao");
  });
});

describe("quando (relógio de Brasília)", () => {
  it("hoje, ontem e dias atrás", () => {
    expect(quando(Date.parse("2026-10-01T17:32:00Z"), agora)).toEqual({ frase: "hoje às 14:32", curto: "14:32" });
    expect(quando(Date.parse("2026-09-30T23:30:00Z"), agora)).toEqual({ frase: "ontem às 20:30", curto: "ontem" });
    expect(quando(Date.parse("2026-09-23T14:05:00Z"), agora)).toEqual({ frase: "23/09 às 11:05 (há 8 dias)", curto: "23/09" });
  });

  it("02:00 UTC ainda é o dia anterior em Brasília", () => {
    expect(quando(Date.parse("2026-10-01T02:00:00Z"), agora).frase).toBe("ontem às 23:00");
  });
});
