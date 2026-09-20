// "E essa cota aí? É verdade? Resolve."
//
// Era verdade que o provedor recusou. Mas o CRM contava a história errada, e
// de um jeito que custa dia de trabalho: tratava limite POR MINUTO (que volta
// em segundos) como se fosse limite POR DIA, congelava o modelo por uma hora e
// escrevia na tela "a cota de IA de hoje acabou". O vendedor lia isso e parava
// de tentar — passava o dia sem Orientador por causa de uma rajada de 9
// segundos.
//
// Os corpos de erro abaixo são os formatos reais dos dois provedores.

import { describe, it, expect } from "vitest";
import {
  tipoDeLimite, esperaInformada, esperaDoLimite, emPortugues, mensagemDeCota,
  ESPERA_PADRAO_MINUTO_MS, ESPERA_PADRAO_DIA_MS,
} from "@/lib/ai/cota";
import { erroDeCotaIA, mensagemErroIA } from "@/lib/ai/erros";

// Groq, limite por minuto — o caso que custava o dia inteiro.
const GROQ_TPM = 'Falha no Groq (429, openai/gpt-oss-120b): {"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org_x` service tier `on_demand` on tokens per minute (TPM): Limit 6000, Used 5980, Requested 240. Please try again in 8.5s.","type":"tokens","code":"rate_limit_exceeded"}}';
// Groq, limite por dia — esse sim só volta na virada.
const GROQ_TPD = 'Falha no Groq (429, openai/gpt-oss-120b): {"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org_x` on tokens per day (TPD): Limit 500000, Used 500000, Requested 2400. Please try again in 4h32m17s.","code":"rate_limit_exceeded"}}';
// Gemini, camada gratuita.
const GEMINI = 'Falha no Gemini (429): {"error":{"code":429,"status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"37s"}]}}';

describe("que limite estourou", () => {
  it("por minuto é reconhecido", () => {
    expect(tipoDeLimite(GROQ_TPM)).toBe("minuto");
    expect(tipoDeLimite("requests per minute")).toBe("minuto");
    expect(tipoDeLimite("RPM excedido")).toBe("minuto");
  });

  it("por dia é reconhecido", () => {
    expect(tipoDeLimite(GROQ_TPD)).toBe("dia");
    expect(tipoDeLimite("requests per day")).toBe("dia");
    expect(tipoDeLimite("TPD")).toBe("dia");
  });

  it("quando os dois aparecem, o DIÁRIO ganha — errar esperando demais é mais seguro", () => {
    expect(tipoDeLimite("tokens per minute and tokens per day")).toBe("dia");
  });

  it("sem pista, não chuta", () => {
    expect(tipoDeLimite("429 Too Many Requests")).toBe("desconhecido");
    expect(tipoDeLimite("")).toBe("desconhecido");
  });
});

describe("quanto esperar, segundo o próprio provedor", () => {
  it("Groq: 'try again in 8.5s'", () => {
    expect(esperaInformada(GROQ_TPM)).toBe(8500);
  });

  it("Groq: 'try again in 4h32m17s'", () => {
    expect(esperaInformada(GROQ_TPD)).toBe(4 * 3_600_000 + 32 * 60_000 + 17_000);
  });

  it("Gemini: retryDelay", () => {
    expect(esperaInformada(GEMINI)).toBe(37_000);
  });

  it("sem informação, devolve null em vez de inventar", () => {
    expect(esperaInformada("429 Too Many Requests")).toBe(null);
    expect(esperaInformada("")).toBe(null);
  });
});

describe("a espera que o CRM usa", () => {
  it("usa o que o provedor informou", () => {
    expect(esperaDoLimite(GROQ_TPM)).toBe(8500);
    expect(esperaDoLimite(GEMINI)).toBe(37_000);
  });

  it("limite por minuto sem informação espera 1 minuto, não 1 hora", () => {
    // Era aqui que a hora fixa jogava fora cota que já tinha voltado.
    expect(esperaDoLimite("tokens per minute (TPM): Limit 6000")).toBe(ESPERA_PADRAO_MINUTO_MS);
  });

  it("limite diário sem informação espera 1 hora e tenta de novo", () => {
    expect(esperaDoLimite("tokens per day (TPD): Limit 500000")).toBe(ESPERA_PADRAO_DIA_MS);
  });

  it("429 sem pista nenhuma é tratado como por minuto — o caso comum", () => {
    expect(esperaDoLimite("429 Too Many Requests")).toBe(ESPERA_PADRAO_MINUTO_MS);
  });

  it("espera absurda é limitada a 6 horas", () => {
    expect(esperaDoLimite("try again in 23h")).toBe(6 * 60 * 60_000);
  });
});

describe("o tempo escrito como gente fala", () => {
  it("segundos, minutos e horas", () => {
    expect(emPortugues(8500)).toBe("9 segundos");
    expect(emPortugues(1000)).toBe("1 segundo");
    expect(emPortugues(180_000)).toBe("3 minutos");
    expect(emPortugues(60_000)).toBe("1 minuto");
    expect(emPortugues(2 * 3_600_000)).toBe("2 horas");
  });
});

describe("a frase que o vendedor lê", () => {
  it("limite por minuto DIZ QUANTO FALTA e não fala em dia", () => {
    const m = mensagemDeCota(GROQ_TPM);
    expect(m).toContain("9 segundos");
    expect(m).toMatch(/limite por minuto/i);
    expect(m).not.toMatch(/de hoje acabou|cota diária/i);
  });

  it("limite diário fala em dia, porque aí é verdade", () => {
    const m = mensagemDeCota(GROQ_TPD);
    expect(m).toMatch(/cota diária/i);
  });

  it("nos dois casos diz que a leitura antiga continua valendo", () => {
    expect(mensagemDeCota(GROQ_TPM)).toMatch(/continua valendo/i);
    expect(mensagemDeCota(GROQ_TPD)).toMatch(/continua valendo/i);
  });

  it("nunca manda configurar chave — ele já tem", () => {
    expect(mensagemDeCota(GROQ_TPM)).not.toMatch(/GEMINI_API_KEY|GROQ_API_KEY|configure/i);
    expect(mensagemDeCota(GROQ_TPD)).not.toMatch(/GEMINI_API_KEY|GROQ_API_KEY|configure/i);
  });
});

describe("o erro que chegava cru na tela", () => {
  it('"Groq: nenhum modelo disponível" agora é tratado como cota', () => {
    // Esse texto é o desfecho de TODOS os modelos terem estourado. Antes caía
    // no fallback genérico e aparecia assim mesmo, em português de máquina.
    expect(erroDeCotaIA(new Error("Groq: nenhum modelo disponível."))).toBe(true);
    const m = mensagemErroIA(new Error("Groq: nenhum modelo disponível."));
    expect(m).not.toContain("nenhum modelo disponível");
    expect(m).toMatch(/continua valendo/i);
  });

  it("o 429 do Groq vira a frase com o tempo certo", () => {
    const m = mensagemErroIA(new Error(GROQ_TPM));
    expect(m).toContain("9 segundos");
    expect(m).not.toContain("rate_limit_exceeded");
    expect(m).not.toContain("429");
  });

  it("o 429 do Gemini idem", () => {
    const m = mensagemErroIA(new Error(GEMINI));
    expect(m).toContain("37 segundos");
    expect(m).not.toContain("RESOURCE_EXHAUSTED");
  });

  it("falta de chave continua com a mensagem própria", () => {
    expect(mensagemErroIA(new Error("Nenhum provedor de IA configurado."))).toMatch(/Defina GEMINI_API_KEY/);
  });
});
