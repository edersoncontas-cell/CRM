import { describe, it, expect } from "vitest";
import { classificarConversa, resumirDia, textoRelatorio, type ConversaDoDia } from "@/lib/cerebro/relatorio-regra";

const base: ConversaDoDia = {
  conversaId: "c1", clienteId: "cli1", nome: "Construtora Vale Verde", telefone: "5528999990001",
  municipio: "Cachoeiro de Itapemirim", texto: "", mensagens: 4, recebidas: 2, enviadas: 2,
  primeiraVez: false, jaComprou: false,
};

const conversa = (texto: string, extra: Partial<ConversaDoDia> = {}): ConversaDoDia => ({ ...base, ...extra, texto });

describe("o que entra no relatório do dia", () => {
  it("entra: cliente pedindo preço de máquina", () => {
    const c = classificarConversa(conversa("Cliente: bom dia, quanto fica a E215C?\nVendedor: vou levantar o valor"));
    expect(c.classe).toBe("negocio");
    expect(c.maquina).toBe("E215C");
  });

  it("entra: financiamento, mesmo sem citar modelo", () => {
    const c = classificarConversa(conversa("Cliente: consigo financiar uma máquina em quantas parcelas? Qual a entrada?"));
    expect(c.classe).toBe("negocio");
    expect(c.temFinanciamento).toBe(true);
  });

  it("entra: rolo Dynapac com o nome novo", () => {
    const c = classificarConversa(conversa("Cliente: me manda proposta do CA25 D"));
    expect(c.classe).toBe("negocio");
    expect(c.maquina).toBe("CA25 D");
  });

  it("não entra: conversa informal", () => {
    expect(classificarConversa(conversa("Cliente: bom dia, tudo bem? Feliz aniversário!")).classe).toBe("informal");
    expect(classificarConversa(conversa("Cliente: passa o endereço do churrasco de sábado")).classe).toBe("informal");
  });

  it("não entra como negociação: assistência e peça", () => {
    const c = classificarConversa(conversa("Cliente: a retro está com vazamento de óleo, preciso de um técnico"));
    expect(c.classe).toBe("posvenda");
  });
});

describe("resumo do dia", () => {
  const conversas = [
    conversa("quanto fica a E215C?", { conversaId: "a", nome: "Cliente A", primeiraVez: true }),
    conversa("me manda proposta do CA25 D", { conversaId: "b", nome: "Cliente B" }),
    conversa("bom dia, tudo bem?", { conversaId: "c", nome: "Cliente C" }),
    conversa("preciso de peça, a máquina quebrou", { conversaId: "d", nome: "Cliente D" }),
  ];

  it("separa contato novo de cliente da carteira", () => {
    const r = resumirDia(conversas);
    expect(r.negocio).toHaveLength(2);
    expect(r.novos).toBe(1);
    expect(r.carteira).toBe(1);
    expect(r.informais).toBe(1);
    expect(r.posvenda).toHaveLength(1);
  });

  it("o texto traz só quem negociou, marcando quem é novo", () => {
    const txt = textoRelatorio({
      dia: "19/09/2026",
      resumo: resumirDia(conversas),
      visitasRealizadas: [{ cliente: "Cliente B", municipio: "Iconha" }],
      visitasAmanha: [],
      faturadas: [{ cliente: "Cliente B", maquina: "CA25 D", valor: 480000 }],
      novasNegociacoes: [],
    });
    expect(txt).toContain("Cliente A");
    expect(txt).toContain("NOVO");
    expect(txt).toContain("Cliente B");
    expect(txt).not.toContain("Cliente C");
    expect(txt).toContain("R$ 480.000");
    expect(txt).toContain("Iconha");
  });

  it("dia sem negociação é dito com todas as letras", () => {
    const txt = textoRelatorio({
      dia: "20/09/2026",
      resumo: resumirDia([conversa("bom dia!", { nome: "Cliente C" })]),
      visitasRealizadas: [], visitasAmanha: [], faturadas: [], novasNegociacoes: [],
    });
    expect(txt).toContain("Nenhuma conversa de negociação hoje");
  });
});
