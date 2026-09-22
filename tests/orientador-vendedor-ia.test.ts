// A LEITURA COM IA — o que dá para provar sem rede.
//
// A resposta do provedor depende de rede e não é testável aqui. O que É
// testável, e é onde mora o risco de verdade: que TODO número que a IA pode
// citar chegue escrito no pedido (se não chegar, ela inventa), que a proibição
// de inventar esteja no texto, e que a assinatura só mude quando o retrato
// mudar — senão cada abertura da tela gastaria cota do vendedor.

import { describe, it, expect } from "vitest";
import { analisarVendedor, type FatosVendedor } from "@/lib/orientador-vendedor";
import { montarPedido, fatosEmTexto, assinaturaDosFatos, limparResposta } from "@/lib/orientador-vendedor-ia";

const FATOS: FatosVendedor = {
  meses: 12,
  criadas: 47, chegaramProposta: 19, chegaramNegociacao: 9, faturadas: 5,
  perdidas: 12, perdidasPorMotivo: { preco: 5, credito: 4, sem_retorno: 2, adiou: 1 },
  perdidasSemMotivo: 0, valorPerdido: 3_820_000,
  abertas: 30, abertasParadas: 16,
  mensagensEnviadas: 120, mensagensComPergunta: 10,
  visitasRealizadas: 38,
};
const diag = analisarVendedor(FATOS);

describe("o pedido leva os números", () => {
  const { system, user } = montarPedido(FATOS, diag, []);

  it("todo número que a IA pode citar está escrito no pedido", () => {
    for (const n of ["47", "19", "9", "5", "12", "30", "16", "120", "10", "38"]) {
      expect(user).toContain(n);
    }
  });

  it("leva os motivos com o nome em português, não a chave crua", () => {
    expect(user).toContain("Preço / condição: 5");
    expect(user).toContain("Crédito negado ou financiamento não saiu: 4");
    expect(user).not.toContain("preco:");
  });

  it("leva o gargalo e o perfil já calculados", () => {
    expect(user).toMatch(/GARGALO.*Oportunidade para Proposta, 40% passam/);
    expect(user).toContain("Vende máquina, ainda não vende conta");
  });

  it("leva os sinais com a gravidade", () => {
    expect(user).toContain("[critico]");
    expect(user).toMatch(/- \[\w+\] O que mais te derruba: Preço \/ condição: 5 das suas 12 perdas/);
  });

  it("proíbe inventar número e comparar com quem não existe", () => {
    expect(system).toMatch(/SOMENTE os números que estão no pedido/i);
    expect(system).toMatch(/não estime/i);
    expect(system).toMatch(/mercado/i);
    expect(system).toMatch(/Não invente cliente, máquina, cidade, valor/i);
  });

  it("não manda a IA repetir a lista como relatório — isso já está na tela", () => {
    expect(system).toMatch(/Não repita a lista de números como relatório/i);
  });
});

describe("as regras do negócio", () => {
  it("entram no system, não no meio dos dados", () => {
    const regra = "Não aceitamos máquina do cliente como entrada.";
    const { system, user } = montarPedido(FATOS, diag, [regra]);
    // No meio dos fatos a IA trata a regra como mais um dado e chega a sugerir
    // justamente o que o vendedor disse que não faz.
    expect(system).toContain(regra);
    expect(user).not.toContain(regra);
    expect(system).toMatch(/nunca sugira o contrário disto/i);
  });

  it("sem regras, o system continua válido", () => {
    const { system } = montarPedido(FATOS, diag, []);
    expect(system).not.toMatch(/A REALIDADE DESTE NEGÓCIO/);
    expect(system).toMatch(/máquinas pesadas/i);
  });
});

describe("perdas sem motivo", () => {
  it("são ditas à IA, para ela saber que o retrato está incompleto", () => {
    const f = { ...FATOS, perdidasSemMotivo: 4, perdidasPorMotivo: { ...FATOS.perdidasPorMotivo, nao_informado: 4 } };
    const t = fatosEmTexto(f, analisarVendedor(f));
    expect(t).toContain("PERDAS SEM MOTIVO REGISTRADO: 4");
    // "nao_informado" não pode virar um "motivo" na lista de motivos.
    expect(t).not.toContain("nao_informado");
  });
});

describe("assinatura dos fatos", () => {
  it("é a mesma quando nada mudou — reler não gasta chamada nova", () => {
    expect(assinaturaDosFatos(FATOS)).toBe(assinaturaDosFatos({ ...FATOS }));
  });
  it("não depende da ordem em que os motivos foram contados", () => {
    const a = assinaturaDosFatos({ ...FATOS, perdidasPorMotivo: { preco: 5, credito: 4, sem_retorno: 2, adiou: 1 } });
    const b = assinaturaDosFatos({ ...FATOS, perdidasPorMotivo: { adiou: 1, sem_retorno: 2, credito: 4, preco: 5 } });
    expect(a).toBe(b);
  });
  it("muda quando o retrato muda", () => {
    expect(assinaturaDosFatos({ ...FATOS, faturadas: 6 })).not.toBe(assinaturaDosFatos(FATOS));
    expect(assinaturaDosFatos({ ...FATOS, abertasParadas: 15 })).not.toBe(assinaturaDosFatos(FATOS));
    expect(assinaturaDosFatos({ ...FATOS, perdidasPorMotivo: { preco: 6 } })).not.toBe(assinaturaDosFatos(FATOS));
  });
});

describe("limpeza da resposta", () => {
  it("tira o 'Claro!' e o título de markdown", () => {
    expect(limparResposta("Claro! \n## Sua leitura\nVocê perde no preço.")).toBe("Você perde no preço.");
  });
  it("tira negrito e marcador de lista, mantendo o texto", () => {
    expect(limparResposta("- **Primeiro:** ajuste a proposta.")).toBe("Primeiro: ajuste a proposta.");
  });
  it("separa os parágrafos", () => {
    expect(limparResposta("Um.\nDois.")).toBe("Um.\n\nDois.");
  });
  it("aguenta resposta vazia", () => {
    expect(limparResposta("")).toBe("");
  });
});
