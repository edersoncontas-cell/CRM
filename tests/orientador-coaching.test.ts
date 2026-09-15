import { describe, expect, it } from "vitest";
import { coachingVazio, dicasParaResposta, normalizarCoaching } from "../src/lib/zeus/orientador-coaching";

describe("normalizarCoaching", () => {
  it("aceita o JSON completo da IA e limita tamanhos", () => {
    const c = normalizarCoaching({
      personalidade: { estilo: "Analítico", descricao: "Compara tudo", comoFalar: ["Traga números", "Custo por hora"], evitar: ["Pressa"], papel: "decisor" },
      alertaAgora: { nivel: "vermelho", titulo: "Não passe o preço ainda", motivo: "Faltam horas/mês e pagamento." },
      conducao: { nota: 11, acertos: ["Pediu a visita"], correcoes: ["Passou preço cedo"] },
      perguntasAgora: ["Quantas horas por mês?", "Vai financiar?"],
      informacoesFaltando: ["horas/mês"],
      roteiro: [{ etapa: "Qualificação", status: "agora", dica: "Pergunte a aplicação" }, { etapa: "Visita", status: "depois", dica: "" }, { etapa: "", status: "x", dica: "" }],
      sinaisCompra: ["Pediu preço"], sinaisRisco: [],
      tratamentoObjecoes: [{ objecao: "Preço", comoTratar: "Leve para custo por hora" }, { objecao: "", comoTratar: "x" }],
    });
    expect(c.personalidade.estilo).toBe("Analítico");
    expect(c.personalidade.papel).toBe("decisor");
    expect(c.alertaAgora).toEqual({ nivel: "vermelho", titulo: "Não passe o preço ainda", motivo: "Faltam horas/mês e pagamento." });
    expect(c.conducao.nota).toBe(10);
    expect(c.roteiro).toEqual([{ etapa: "Qualificação", status: "agora", dica: "Pergunte a aplicação" }, { etapa: "Visita", status: "depois", dica: "" }]);
    expect(c.tratamentoObjecoes).toEqual([{ objecao: "Preço", comoTratar: "Leve para custo por hora" }]);
  });

  it("tolera JSON incompleto ou com tipos errados", () => {
    const c = normalizarCoaching({ personalidade: { estilo: "Chato" }, alertaAgora: { nivel: "roxo", titulo: "x" }, conducao: { nota: "abc" }, perguntasAgora: "não é lista" });
    expect(c.personalidade.estilo).toBeNull();
    expect(c.alertaAgora).toBeNull();
    expect(c.conducao.nota).toBe(5);
    expect(c.perguntasAgora).toEqual([]);
    expect(normalizarCoaching(null)).toEqual(coachingVazio());
  });
});

describe("dicasParaResposta", () => {
  it("condensa alerta, perfil, faltantes, perguntas e próxima ação", () => {
    const c = normalizarCoaching({ alertaAgora: { nivel: "vermelho", titulo: "Não passe o preço", motivo: "Qualifique antes." }, personalidade: { estilo: "Dominante", comoFalar: ["Seja direto"], evitar: ["Textão"] }, informacoesFaltando: ["horas/mês"], perguntasAgora: ["Quantas horas por mês?"] });
    const d = dicasParaResposta(c, "Marcar visita quinta");
    expect(d).toContain("ALERTA (vermelho): Não passe o preço. Qualifique antes.");
    expect(d).toContain("Cliente Dominante: Seja direto. Evite: Textão");
    expect(d).toContain("Ainda falta saber: horas/mês");
    expect(d).toContain("Perguntas que destravam agora: Quantas horas por mês?");
    expect(d).toContain("Próxima ação definida: Marcar visita quinta");
    expect(dicasParaResposta(coachingVazio(), "")).toBe("");
  });
});
