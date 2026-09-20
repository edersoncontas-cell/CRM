// A caixa de contexto nasceu para guardar FATO. Mas o vendedor escreveu ORDEM:
//
//   "Wadson não é construtora, ele é o proprietário da empresa BWB que já está
//    no nosso funil, vincular todas essas informações na proposta que já está
//    em negociação"
//
// Isso não é fato a registrar, é coisa a FAZER — e ficava parada no texto.
// Agora o Orientador entende pedidos assim e PROPÕE; quem executa é o clique
// do vendedor.
//
// O que estes testes protegem: unir dois cadastros arrasta negociação, visita,
// alerta e histórico de um cliente real. Um alvo entendido errado, ou um
// desempate no chute entre dois cadastros parecidos, faz um estrago grande e
// silencioso. Então o caminho tem de ser estreito: na dúvida, não escolhe.

import { describe, it, expect } from "vitest";
import {
  normalizarPedidos, alvoUtil, descreverPedido, escolherAlvo, guardarPedidos, lerPedidos,
} from "@/lib/orientador-pedidos";

describe("o pedido que o Orientador devolve", () => {
  it("o caso real: vincular à BWB", () => {
    const p = normalizarPedidos([
      { tipo: "vincular_cliente", alvo: "BWB", motivo: "Ele disse que é o proprietário da BWB." },
    ]);
    expect(p).toHaveLength(1);
    expect(p[0].tipo).toBe("vincular_cliente");
    expect(p[0].alvo).toBe("BWB");
  });

  it("tipo que o CRM não sabe executar é descartado", () => {
    expect(normalizarPedidos([{ tipo: "apagar_cliente", alvo: "BWB" }])).toEqual([]);
    expect(normalizarPedidos([{ tipo: "mandar_email", alvo: "BWB" }])).toEqual([]);
  });

  it("alvo genérico não vira pedido — senão uniria com qualquer um", () => {
    for (const alvo of ["a empresa", "o cliente", "ele", "construtora", "", "  ", "123", "-"]) {
      expect(normalizarPedidos([{ tipo: "vincular_cliente", alvo }])).toEqual([]);
    }
  });

  it("alvo de verdade passa", () => {
    expect(alvoUtil("BWB")).toBe(true);
    expect(alvoUtil("Construtora Litoral")).toBe(true);
    expect(alvoUtil("empresa")).toBe(false);
  });

  it("resposta sem pedidos é o normal e não quebra", () => {
    expect(normalizarPedidos(undefined)).toEqual([]);
    expect(normalizarPedidos("texto")).toEqual([]);
    expect(normalizarPedidos([])).toEqual([]);
    expect(normalizarPedidos([null, 3, "x"])).toEqual([]);
  });

  it("não repete o mesmo pedido", () => {
    const p = normalizarPedidos([
      { tipo: "vincular_cliente", alvo: "BWB" },
      { tipo: "vincular_cliente", alvo: "bwb" },
    ]);
    expect(p).toHaveLength(1);
  });
});

describe("a frase que o vendedor lê antes de confirmar", () => {
  it("diz de onde para onde, e o que vai junto", () => {
    const t = descreverPedido({ tipo: "vincular_cliente", alvo: "BWB", motivo: "" }, "Wadson Pires Ratinho");
    expect(t).toContain("Wadson Pires Ratinho");
    expect(t).toContain("BWB");
    expect(t).toContain("negociações");
    expect(t).toContain("histórico");
  });
});

describe("achar o cliente alvo", () => {
  const lista = [
    { id: "1", nome: "BWB Construções" },
    { id: "2", nome: "Construtora Litoral" },
    { id: "3", nome: "Wadson Pires Ratinho" },
  ];

  it("nome exato ganha", () => {
    expect(escolherAlvo("Construtora Litoral", lista).escolhido?.id).toBe("2");
  });

  it("sigla casa com o nome completo, como palavra inteira", () => {
    expect(escolherAlvo("BWB", lista).escolhido?.id).toBe("1");
  });

  it("não casa no meio da palavra", () => {
    const r = escolherAlvo("BWB", [{ id: "9", nome: "Bwbra Ltda" }]);
    expect(r.escolhido).toBe(null);
  });

  it("acento e caixa não atrapalham", () => {
    expect(escolherAlvo("construções bwb".replace("construções bwb", "bwb construcoes"), lista).escolhido?.id).toBe("1");
  });

  it("NÃO desempata no chute quando há dois parecidos", () => {
    const dois = [{ id: "a", nome: "BWB Construções" }, { id: "b", nome: "BWB Locações" }];
    const r = escolherAlvo("BWB", dois);
    expect(r.escolhido).toBe(null);
    expect(r.ambiguos.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("não devolve o próprio cliente da conversa", () => {
    const r = escolherAlvo("Wadson Pires Ratinho", lista, "3");
    expect(r.escolhido).toBe(null);
  });

  it("nome que não existe devolve nada, em vez de inventar", () => {
    expect(escolherAlvo("Empresa Que Não Existe", lista).escolhido).toBe(null);
  });
});

describe("guardar e ler os pedidos pendentes", () => {
  it("ida e volta", () => {
    const p = [{ tipo: "vincular_cliente" as const, alvo: "BWB", motivo: "dono da empresa" }];
    expect(lerPedidos(guardarPedidos(p))).toEqual(p);
  });

  it("sem pedido, o campo fica limpo no banco", () => {
    expect(guardarPedidos([])).toBe(null);
  });

  it("lixo gravado não derruba a tela", () => {
    expect(lerPedidos("não é json")).toEqual([]);
    expect(lerPedidos(null)).toEqual([]);
    expect(lerPedidos('[{"tipo":"coisa_errada"}]')).toEqual([]);
  });
});
