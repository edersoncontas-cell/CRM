import { describe, expect, it } from "vitest";
import { CANDIDATOS_GROQ, escolherModeloGroq, erroDeModeloGroq, erroDeJsonGroq, parametrosGroq } from "../src/lib/ai/groq";

describe("escolha automática do modelo do Groq", () => {
  it("usa o modelo do ambiente quando ele existe na conta", () => {
    expect(escolherModeloGroq("llama-3.1-8b-instant", new Set(["llama-3.1-8b-instant", "openai/gpt-oss-120b"]), new Set())).toBe("llama-3.1-8b-instant");
  });
  it("ignora o modelo do ambiente quando o Groq o desativou e pega o mais forte disponível", () => {
    expect(escolherModeloGroq("llama-3.3-70b-versatile", new Set(["openai/gpt-oss-20b", "llama-3.1-8b-instant"]), new Set())).toBe("openai/gpt-oss-20b");
  });
  it("pula modelos marcados como ruins", () => {
    expect(escolherModeloGroq(undefined, new Set(["openai/gpt-oss-120b", "openai/gpt-oss-20b"]), new Set(["openai/gpt-oss-120b"]))).toBe("openai/gpt-oss-20b");
  });
  it("sem lista (falha ao consultar), usa o do ambiente ou o primeiro candidato", () => {
    expect(escolherModeloGroq("meu-modelo", new Set(), new Set())).toBe("meu-modelo");
    expect(escolherModeloGroq(undefined, new Set(), new Set())).toBe(CANDIDATOS_GROQ[0]);
  });
  it("modelo com raciocínio ganha limite maior e esforço baixo; JSON estrito só na 1ª tentativa", () => {
    expect(parametrosGroq("openai/gpt-oss-120b", 1024, true)).toEqual({ model: "openai/gpt-oss-120b", max_tokens: 5024, reasoning_effort: "low", response_format: { type: "json_object" } });
    expect(parametrosGroq("openai/gpt-oss-120b", 1024, true, true)).toEqual({ model: "openai/gpt-oss-120b", max_tokens: 5024, reasoning_effort: "low" });
    expect(parametrosGroq("qwen/qwen3-32b", 500, false)).toEqual({ model: "qwen/qwen3-32b", max_tokens: 4500, reasoning_format: "hidden" });
    expect(parametrosGroq("llama-3.1-8b-instant", 500, true)).toEqual({ model: "llama-3.1-8b-instant", max_tokens: 500, response_format: { type: "json_object" } });
  });
  it("reconhece a falha de JSON do Groq", () => {
    expect(erroDeJsonGroq(new Error('Falha no Groq (400): {"error":{"message":"Failed to validate JSON. Please adjust your prompt.","code":"json_validate_failed"}}'))).toBe(true);
    expect(erroDeJsonGroq(new Error("429"))).toBe(false);
  });
  it("reconhece o erro de modelo inexistente", () => {
    expect(erroDeModeloGroq(new Error("404 The model `llama-3.3-70b-versatile` does not exist or you do not have access to it."))).toBe(true);
    expect(erroDeModeloGroq(new Error("429 rate limit"))).toBe(false);
  });
});
