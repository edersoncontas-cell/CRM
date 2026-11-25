import { describe, it, expect } from "vitest";
import {
  lerFatosGuardados, somarFatos, fatosComNotas, montarResumoConversa, resumoConversaDoForm,
  colunaInicialDaOportunidade, LIMITE_RESUMO_CONVERSA,
} from "../src/lib/oportunidade-da-conversa";
import { FATOS_VAZIOS } from "../src/lib/orientador-fatos";

describe("lerFatosGuardados", () => {
  it("coluna vazia ou lixo vira 'não sabe', nunca quebra", () => {
    expect(lerFatosGuardados(null)).toEqual(FATOS_VAZIOS);
    expect(lerFatosGuardados("texto")).toEqual(FATOS_VAZIOS);
    expect(lerFatosGuardados({ condicaoPagamento: "outro" }).condicaoPagamento).toBeNull();
  });
  it("lê o que foi gravado", () => {
    const f = lerFatosGuardados({ maquinaModelo: "B110C", condicaoPagamento: "financiado", valor: 610000 });
    expect(f.maquinaModelo).toBe("B110C");
    expect(f.condicaoPagamento).toBe("financiamento");
    expect(f.valor).toBe(610000);
  });
});

describe("somarFatos", () => {
  it("leitura nova que não falou de pagamento não apaga o pagamento guardado", () => {
    const guardados = { ...FATOS_VAZIOS, condicaoPagamento: "avista" as const, maquinaModelo: "B110C" };
    const novos = { ...FATOS_VAZIOS, valor: 500000 };
    const r = somarFatos(guardados, novos);
    expect(r).toMatchObject({ condicaoPagamento: "avista", maquinaModelo: "B110C", valor: 500000 });
  });
  it("o que a leitura nova trouxe ganha", () => {
    const r = somarFatos({ ...FATOS_VAZIOS, maquinaModelo: "B95" }, { ...FATOS_VAZIOS, maquinaModelo: "B110C" });
    expect(r.maquinaModelo).toBe("B110C");
  });
});

describe("fatosComNotas", () => {
  it("o que o vendedor escreveu vale mais que a leitura da IA", () => {
    const base = { ...FATOS_VAZIOS, condicaoPagamento: "avista" as const };
    const r = fatosComNotas(base, [{ em: null, texto: "Vai ser financiamento, entrada 10%" }]);
    expect(r.condicaoPagamento).toBe("financiamento");
    expect(r.entradaPercentual).toBe(10);
  });
});

describe("montarResumoConversa", () => {
  const analise = {
    resumoNegociacao: "Cliente quer uma retro para obra da prefeitura.",
    perfilComprador: "técnico",
    combinados: ["Enviar proposta até sexta"],
    pendencias: ["Mandar documentos do CNPJ", "  "],
    objecoes: [],
    atualizadoEm: new Date("2026-11-20T15:00:00Z"),
  };
  it("leva resumo, combinados, pendências e notas", () => {
    const t = montarResumoConversa(analise, [{ em: null, texto: "Falei por telefone: quer em 60 dias" }])!;
    expect(t).toContain("Cliente quer uma retro");
    expect(t).toContain("Já combinado:\n• Enviar proposta até sexta");
    expect(t).toContain("Pendente:\n• Mandar documentos do CNPJ");
    expect(t).not.toContain("Objeções");
    expect(t).toContain("• Falei por telefone");
    expect(t).toContain("20/11/2026");
  });
  it("nada guardado = null (a tela diz que o Orientador não leu)", () => {
    expect(montarResumoConversa(null, [])).toBeNull();
    expect(montarResumoConversa({ ...analise, resumoNegociacao: "", perfilComprador: null, combinados: [], pendencias: [] }, [])).toBeNull();
  });
  it("não passa do teto", () => {
    const t = montarResumoConversa({ ...analise, resumoNegociacao: "x".repeat(9000) }, [])!;
    expect(t.length).toBeLessThanOrEqual(LIMITE_RESUMO_CONVERSA);
  });
});

describe("resumoConversaDoForm", () => {
  it("vazio vira null e nada passa do teto", () => {
    expect(resumoConversaDoForm(null)).toBeNull();
    expect(resumoConversaDoForm("   ")).toBeNull();
    expect(resumoConversaDoForm("y".repeat(5000))!.length).toBe(LIMITE_RESUMO_CONVERSA);
  });
});

describe("colunaInicialDaOportunidade", () => {
  const colunas = [
    { titulo: "OPORTUNIDADE", papel: "em_negociacao" },
    { titulo: "VISITA PENDENTE", papel: "em_negociacao" },
    { titulo: "FATURADO", papel: "faturado" },
  ];
  it("sem visita, a primeira coluna em negociação; com visita, a de visita pendente", () => {
    expect(colunaInicialDaOportunidade(colunas, false)).toBe("OPORTUNIDADE");
    expect(colunaInicialDaOportunidade(colunas, true)).toBe("VISITA PENDENTE");
  });
});
