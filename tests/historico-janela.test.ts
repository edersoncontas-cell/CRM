// "Todas as informações precisam ser baseadas em TODO o contexto da conversa."
//
// Não estavam. A janela era de 24 mil caracteres e o corte era
// `historico.slice(-24000)`: ficavam só as ÚLTIMAS mensagens e o começo sumia.
// Numa venda de máquina, o começo é onde está a qualificação — qual aplicação,
// qual obra, qual prazo, quem decide. Analisar só o fim é entrar na reunião no
// minuto 50, e foi isso que fez o Orientador perguntar coisas já respondidas.
//
// Agora a janela é grande o bastante para quase toda conversa caber inteira, e
// quando não cabe o corte guarda as DUAS pontas com um aviso no meio.

import { describe, it, expect } from "vitest";
import { recortarHistorico, JANELA_HISTORICO, MAX_MENSAGENS } from "@/lib/zeus/historico-janela";

const linhas = (n: number, prefixo: string) =>
  Array.from({ length: n }, (_, i) => `[01/0${(i % 9) + 1}/2026] ${prefixo} ${i}: ${"conversa ".repeat(20)}`).join("\n");

describe("a janela dá conta da conversa inteira", () => {
  it("é muito maior que os 24 mil de antes", () => {
    expect(JANELA_HISTORICO).toBeGreaterThanOrEqual(100_000);
  });

  it("busca mensagens o bastante para anos de conversa", () => {
    expect(MAX_MENSAGENS).toBeGreaterThanOrEqual(1_000);
  });

  it("conversa que cabe passa INTEIRA, sem tocar em nada", () => {
    const h = linhas(50, "Cliente");
    expect(recortarHistorico(h)).toBe(h);
  });

  it("vazio não quebra", () => {
    expect(recortarHistorico("")).toBe("");
  });
});

describe("quando nem assim cabe", () => {
  const inicio = "PRIMEIRA MENSAGEM: preciso de uma retro para drenagem na obra do DER, prazo de 60 dias.";
  const fim = "ULTIMA MENSAGEM: mando a documentacao segunda-feira.";
  const enorme = [inicio, linhas(4000, "Meio"), fim].join("\n");

  it("o COMEÇO sobrevive — era ele que se perdia", () => {
    const r = recortarHistorico(enorme, 5_000);
    expect(r).toContain("PRIMEIRA MENSAGEM");
    expect(r).toContain("drenagem");
  });

  it("o FIM também, que é onde a negociação está", () => {
    expect(recortarHistorico(enorme, 5_000)).toContain("ULTIMA MENSAGEM");
  });

  it("avisa que o meio foi omitido, para a IA não achar que nunca existiu", () => {
    const r = recortarHistorico(enorme, 5_000);
    expect(r).toContain("omitidos por tamanho");
    expect(r).toContain("não conclua que nunca foi conversado");
  });

  it("respeita o limite pedido", () => {
    const r = recortarHistorico(enorme, 5_000);
    expect(r.length).toBeLessThanOrEqual(5_000);
  });

  it("o corte antigo (só o fim) perderia o começo — é o que mudou", () => {
    const antigo = enorme.slice(-5_000);
    expect(antigo).not.toContain("PRIMEIRA MENSAGEM");
    expect(recortarHistorico(enorme, 5_000)).toContain("PRIMEIRA MENSAGEM");
  });

  it("o fim recebe mais espaço que o começo, sem o começo sumir", () => {
    const r = recortarHistorico(enorme, 10_000);
    const posAviso = r.indexOf("omitidos por tamanho");
    expect(posAviso).toBeGreaterThan(0);
    expect(posAviso).toBeLessThan(r.length / 2);
  });

  it("texto sem quebra de linha nenhuma também é cortado direito", () => {
    const corrido = "A".repeat(2000) + "MEIO" + "B".repeat(2000);
    const r = recortarHistorico(corrido, 1_000);
    expect(r.length).toBeLessThanOrEqual(1_000);
    expect(r.startsWith("A")).toBe(true);
    expect(r.endsWith("B")).toBe(true);
  });
});
