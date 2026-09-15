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
    expect(m).toMatch(/cota diária/i);
    expect(m).not.toContain("{");
    expect(mensagemErroIA(new Error("model `x` does not exist"))).toMatch(/desativado/);
    expect(mensagemErroIA(new Error("Falha no Groq (500): {\"error\":\"x\"} algo deu errado"))).toBe("Falha no Groq (500): algo deu errado");
  });
});
