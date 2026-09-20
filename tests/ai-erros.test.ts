import { describe, expect, it } from "vitest";
import { erroDeCotaIA, mensagemErroIA } from "../src/lib/ai/erros";

const groq429 = new Error('Falha no Groq (429, openai/gpt-oss-120b): {"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization `org_x` service tier `on_demand` on tokens per day (TPD): Limit 200000, Used 199265"}}');

describe("erros de IA", () => {
  it("reconhece cota/rate limit de qualquer provedor", () => {
    expect(erroDeCotaIA(groq429)).toBe(true);
    expect(erroDeCotaIA(new Error("Falha no Gemini (429): RESOURCE_EXHAUSTED"))).toBe(true);
    expect(erroDeCotaIA(new Error("insufficient_quota"))).toBe(true);
    expect(erroDeCotaIA(new Error("Falha no Groq (500): oops"))).toBe(false);
  });
  it("traduz para o vendedor sem o JSON cru", () => {
    const m = mensagemErroIA(groq429);
    // O fixture é um limite POR DIA (TPD), então a frase fala em cota DIÁRIA.
    // A distinção é nova e é o ponto: antes todo 429 virava "a cota de hoje
    // acabou", inclusive o limite por minuto, que volta em segundos — e o
    // vendedor passava o dia sem o painel à toa. Ver tests/ai-cota.test.ts.
    expect(m).toMatch(/cota diária de IA/i);
    expect(m).not.toContain("{");
    // NÃO manda configurar chave: a mensagem antiga dizia "configure
    // GEMINI_API_KEY (grátis) como reserva" para quem já tinha a chave — e
    // aparecia numa tarja vermelha sobre o painel do Orientador, dando a
    // entender que a leitura estava errada quando ela só estava desatualizada.
    expect(m).not.toContain("GEMINI_API_KEY");
    expect(m).toMatch(/continua valendo/i);
    expect(mensagemErroIA(new Error("model `x` does not exist"))).toMatch(/desativado/);
    expect(mensagemErroIA(new Error("Falha no Groq (500): {\"error\":\"x\"} algo deu errado"))).toBe("Falha no Groq (500): algo deu errado");
  });
});
