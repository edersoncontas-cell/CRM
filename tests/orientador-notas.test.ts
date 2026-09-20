// A caixa "O que o Orientador precisa saber" passou a LIMPAR depois de
// "Salvar e atualizar", para o vendedor escrever o próximo contexto.
//
// Isso obrigou a mudar o que acontece por baixo: antes a nota era UM texto,
// trocado a cada salvamento. Com a caixa limpando, trocar apagaria o anterior
// — escrever "máquina é a E145C" hoje e "vai financiar pelo Sicoob" amanhã
// perderia a máquina. Agora cada salvamento ACRESCENTA uma entrada datada.

import { describe, it, expect } from "vitest";
import {
  lerNotas, gravarNotas, acrescentarNota, removerNota, textoParaPrompt, LIMITE_TOTAL,
} from "@/lib/orientador-notas";

const EM_1 = new Date("2026-09-20T12:00:00Z");
const EM_2 = new Date("2026-09-22T12:00:00Z");

describe("acumular contextos", () => {
  it("o segundo contexto NÃO apaga o primeiro — é o ponto de tudo isto", () => {
    let guardado = acrescentarNota(null, "Máquina é a Escavadeira E145C", EM_1);
    guardado = acrescentarNota(guardado, "Vai financiar pelo Sicoob", EM_2);
    const notas = lerNotas(guardado);
    expect(notas).toHaveLength(2);
    expect(notas[0].texto).toBe("Máquina é a Escavadeira E145C");
    expect(notas[1].texto).toBe("Vai financiar pelo Sicoob");
  });

  it("guarda a data de cada um, que é como a IA sabe qual é o mais novo", () => {
    const g = acrescentarNota(null, "Fechamos em 610 mil", EM_1);
    expect(lerNotas(g)[0].em).toBe(EM_1.toISOString());
  });

  it("clicar duas vezes em salvar não duplica o mesmo fato", () => {
    let g = acrescentarNota(null, "Máquina é a E145C", EM_1);
    g = acrescentarNota(g, "Máquina é a E145C", EM_2);
    g = acrescentarNota(g, "  máquina É a e145c  ", EM_2);
    expect(lerNotas(g)).toHaveLength(1);
  });

  it("texto vazio não vira entrada", () => {
    expect(lerNotas(acrescentarNota(null, "   \n ", EM_1))).toHaveLength(0);
    expect(acrescentarNota(null, "", EM_1)).toBe(null);
  });
});

describe("nota antiga, de antes da mudança", () => {
  it("texto puro que já estava no banco continua valendo", () => {
    const notas = lerNotas("Combinei por telefone a visita de quinta");
    expect(notas).toHaveLength(1);
    expect(notas[0].texto).toBe("Combinei por telefone a visita de quinta");
    expect(notas[0].em).toBe(null);
  });

  it("e recebe os contextos novos por cima, sem perder o antigo", () => {
    const g = acrescentarNota("Nota antiga de antes", "Contexto novo", EM_1);
    const notas = lerNotas(g);
    expect(notas.map((n) => n.texto)).toEqual(["Nota antiga de antes", "Contexto novo"]);
  });

  it("vazio e nulo não quebram", () => {
    expect(lerNotas(null)).toEqual([]);
    expect(lerNotas("")).toEqual([]);
    expect(lerNotas("   ")).toEqual([]);
  });

  it("JSON corrompido não derruba a tela: vira uma entrada de texto", () => {
    const notas = lerNotas('[{"texto": quebrado');
    expect(notas).toHaveLength(1);
  });
});

describe("apagar um contexto errado", () => {
  it("tira só o escolhido", () => {
    let g = acrescentarNota(null, "primeiro", EM_1);
    g = acrescentarNota(g, "errado", EM_1);
    g = acrescentarNota(g, "terceiro", EM_2);
    const notas = lerNotas(removerNota(g, 1));
    expect(notas.map((n) => n.texto)).toEqual(["primeiro", "terceiro"]);
  });

  it("índice inválido não faz nada", () => {
    const g = acrescentarNota(null, "único", EM_1);
    expect(lerNotas(removerNota(g, 9))).toHaveLength(1);
    expect(lerNotas(removerNota(g, -1))).toHaveLength(1);
  });

  it("apagar o último deixa o campo limpo no banco", () => {
    const g = acrescentarNota(null, "único", EM_1);
    expect(removerNota(g, 0)).toBe(null);
  });
});

describe("teto do conjunto", () => {
  // A nota inteira vai no prompt a cada análise: crescer sem fim custaria
  // dinheiro e diluiria o que é recente no meio de coisa velha.
  it("ao estourar, as entradas mais ANTIGAS saem", () => {
    let g: string | null = null;
    for (let i = 0; i < 40; i++) g = acrescentarNota(g, `contexto ${i} ` + "x".repeat(300), new Date(EM_1.getTime() + i * 86400000));
    const notas = lerNotas(g);
    expect(notas.reduce((s, n) => s + n.texto.length, 0)).toBeLessThanOrEqual(LIMITE_TOTAL);
    expect(notas[notas.length - 1].texto).toContain("contexto 39");
    expect(notas.some((n) => n.texto.includes("contexto 0 "))).toBe(false);
  });

  it("a entrada recém-escrita nunca é descartada, nem sendo enorme", () => {
    const g = acrescentarNota(null, "y".repeat(LIMITE_TOTAL + 5000), EM_1);
    expect(lerNotas(g)).toHaveLength(1);
  });
});

describe("como chega à IA", () => {
  it("um contexto só vai direto, sem cerimônia", () => {
    const g = acrescentarNota(null, "Máquina é a E145C", EM_1);
    expect(textoParaPrompt(g)).toBe("[20/09/2026] Máquina é a E145C");
  });

  it("vários vão em ordem, com o aviso de que o mais novo ganha", () => {
    let g = acrescentarNota(null, "Fechamos em 610 mil", EM_1);
    g = acrescentarNota(g, "Consegui fechar em 600 mil", EM_2);
    const t = textoParaPrompt(g)!;
    expect(t).toContain("VALE O MAIS NOVO");
    expect(t.indexOf("610 mil")).toBeLessThan(t.indexOf("600 mil"));
  });

  it("sem contexto nenhum, não manda texto vazio para a IA", () => {
    expect(textoParaPrompt(null)).toBe(null);
    expect(textoParaPrompt(gravarNotas([]))).toBe(null);
  });
});
