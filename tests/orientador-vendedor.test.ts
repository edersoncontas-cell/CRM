// O ORIENTADOR DO VENDEDOR.
//
// O risco aqui é diferente do resto do CRM: um número errado numa tela de
// funil confunde; um diagnóstico errado sobre o vendedor manda ele estudar a
// coisa errada por semanas. Por isso os testes cobrem os dois lados: o sinal
// que TEM que aparecer, e o que NÃO pode aparecer sem base.

import { describe, it, expect } from "vitest";
import {
  analisarVendedor, passagens, planoDeEstudo, MINIMO_PARA_TAXA, DIAS_PARADA,
  type FatosVendedor,
} from "@/lib/orientador-vendedor";

const BASE: FatosVendedor = {
  meses: 12,
  criadas: 40, chegaramProposta: 24, chegaramNegociacao: 12, faturadas: 8,
  perdidas: 10, perdidasPorMotivo: {}, perdidasSemMotivo: 0, valorPerdido: 0,
  abertas: 10, abertasParadas: 0,
  mensagensEnviadas: 200, mensagensComPergunta: 60,
  visitasRealizadas: 40,
};
const f = (p: Partial<FatosVendedor> = {}): FatosVendedor => ({ ...BASE, ...p });
const ids = (d: ReturnType<typeof analisarVendedor>) => d.sinais.map((s) => s.id);

describe("passagens do funil", () => {
  it("mede quem PASSOU da fase, não quem está parado nela", () => {
    const p = passagens(f({ criadas: 40, chegaramProposta: 24, chegaramNegociacao: 12, faturadas: 8 }));
    expect(p.map((x) => `${x.de}→${x.para}`)).toEqual(["Oportunidade→Proposta", "Proposta→Negociação", "Negociação→Faturado"]);
    expect(p[0].taxa).toBeCloseTo(0.6);
    expect(p[1].taxa).toBeCloseTo(0.5);
    expect(p[2].taxa).toBeCloseTo(2 / 3);
  });

  it("não calcula taxa sobre base pequena — 1 de 2 não é 50% de nada", () => {
    expect(passagens(f({ criadas: MINIMO_PARA_TAXA - 1, chegaramProposta: 1, chegaramNegociacao: 0, faturadas: 0 }))).toEqual([]);
  });
});

describe("gargalo", () => {
  it("aponta a passagem mais fraca, não a última", () => {
    const d = analisarVendedor(f({ criadas: 40, chegaramProposta: 10, chegaramNegociacao: 8, faturadas: 6 }));
    expect(d.gargalo).toMatchObject({ de: "Oportunidade", para: "Proposta" });
    expect(d.sinais.find((s) => s.id === "gargalo:Oportunidade")?.gravidade).toBe("critico");
    expect(d.sinais.find((s) => s.id === "gargalo:Oportunidade")?.modulos).toContain("m4");
  });

  it("crédito aprovado que não fatura manda estudar fechamento", () => {
    const d = analisarVendedor(f({ criadas: 40, chegaramProposta: 36, chegaramNegociacao: 30, faturadas: 3 }));
    expect(d.gargalo).toMatchObject({ de: "Negociação", para: "Faturado" });
    expect(d.sinais.find((s) => s.id === "gargalo:Negociação")?.modulos).toEqual(expect.arrayContaining(["m6", "m8"]));
  });
});

describe("motivo de perda que mais repete", () => {
  it("vira sinal crítico quando é 40% ou mais das perdas", () => {
    const d = analisarVendedor(f({ perdidas: 10, perdidasPorMotivo: { preco: 6, adiou: 4 } }));
    const s = d.sinais.find((x) => x.id === "motivo:preco");
    expect(s?.gravidade).toBe("critico");
    expect(s?.fato).toContain("6 das suas 10 perdas");
    expect(s?.modulos).toEqual(expect.arrayContaining(["m5", "m6"]));
  });

  it("ignora 'não informado' na hora de eleger o campeão", () => {
    const d = analisarVendedor(f({ perdidas: 10, perdidasPorMotivo: { nao_informado: 7, credito: 3 } }));
    expect(ids(d)).toContain("motivo:credito");
    expect(ids(d).some((i) => i.includes("nao_informado"))).toBe(false);
  });

  it("com menos de 3 perdas não elege campeão nenhum", () => {
    const d = analisarVendedor(f({ perdidas: 2, perdidasPorMotivo: { preco: 2 } }));
    expect(ids(d).some((i) => i.startsWith("motivo:"))).toBe(false);
  });
});

describe("follow-up", () => {
  it("acusa negociação aberta parada", () => {
    const d = analisarVendedor(f({ abertas: 10, abertasParadas: 5 }));
    const s = d.sinais.find((x) => x.id === "paradas");
    expect(s?.gravidade).toBe("critico");
    expect(s?.fato).toContain(`mais de ${DIAS_PARADA} dias`);
  });
  it("não acusa quando não há parada", () => {
    expect(ids(analisarVendedor(f({ abertasParadas: 0 })))).not.toContain("paradas");
  });
});

describe("topo de funil", () => {
  it("acusa entrada magra e manda prospectar", () => {
    const d = analisarVendedor(f({ criadas: 12, meses: 12, chegaramProposta: 8, chegaramNegociacao: 5, faturadas: 4 }));
    const s = d.sinais.find((x) => x.id === "entrada");
    expect(s?.modulos).toContain("m3");
    expect(s?.fato).toContain("1.0 por mês");
  });
  it("não acusa quem tem entrada boa", () => {
    expect(ids(analisarVendedor(f({ criadas: 60, meses: 12 })))).not.toContain("entrada");
  });
});

describe("pergunta x informa", () => {
  it("acusa quem quase não pergunta", () => {
    const d = analisarVendedor(f({ mensagensEnviadas: 200, mensagensComPergunta: 10 }));
    expect(d.sinais.find((x) => x.id === "perguntas")?.gravidade).toBe("critico");
  });
  it("com poucas mensagens não diz nada — 2 de 5 não é estilo de venda", () => {
    expect(ids(analisarVendedor(f({ mensagensEnviadas: 5, mensagensComPergunta: 0 })))).not.toContain("perguntas");
  });
});

describe("perda sem justificativa", () => {
  it("avisa que o diagnóstico está incompleto", () => {
    const d = analisarVendedor(f({ perdidasSemMotivo: 3 }));
    expect(d.sinais.find((x) => x.id === "sem_motivo")?.fato).toContain("3 perda(s)");
  });
});

describe("o que vai bem", () => {
  it("reconhece conversão alta em vez de só apontar defeito", () => {
    const d = analisarVendedor(f({ criadas: 20, faturadas: 8, chegaramProposta: 16, chegaramNegociacao: 10 }));
    const s = d.sinais.find((x) => x.id === "conversao_boa");
    expect(s?.gravidade).toBe("bom");
    expect(d.sinais.some((x) => x.gravidade === "bom")).toBe(true);
  });

  it("muita visita por venda vira alerta", () => {
    const d = analisarVendedor(f({ visitasRealizadas: 100, faturadas: 5 }));
    expect(d.sinais.find((x) => x.id === "visitas_por_venda")?.gravidade).toBe("atencao");
  });
});

describe("ordem e plano de estudo", () => {
  it("põe o crítico na frente e o que vai bem no fim", () => {
    const d = analisarVendedor(f({
      criadas: 40, chegaramProposta: 8, chegaramNegociacao: 6, faturadas: 5,
      perdidas: 10, perdidasPorMotivo: { preco: 6 }, abertas: 10, abertasParadas: 5,
    }));
    const g = d.sinais.map((s) => s.gravidade);
    expect(g).toEqual([...g].sort((a, b) => ({ critico: 0, atencao: 1, bom: 2 })[a] - ({ critico: 0, atencao: 1, bom: 2 })[b]));
  });

  it("o plano não repete módulo e ignora o que já vai bem", () => {
    const d = analisarVendedor(f({
      criadas: 40, chegaramProposta: 8, chegaramNegociacao: 6, faturadas: 5,
      perdidas: 10, perdidasPorMotivo: { concorrente: 6 },
    }));
    const p = planoDeEstudo(d);
    expect(new Set(p.modulos).size).toBe(p.modulos.length);
    expect(new Set(p.etapas).size).toBe(p.etapas.length);
    const bons = d.sinais.filter((s) => s.gravidade === "bom").flatMap((s) => s.modulos);
    for (const m of bons) if (!d.sinais.some((s) => s.gravidade !== "bom" && s.modulos.includes(m))) expect(p.modulos).not.toContain(m);
  });
});

describe("perfil", () => {
  // Este teste nasceu de um erro meu: com a ordem de checagem fixa, um sinal
  // LEVE ("entra pouca gente", 3.9/mês) ganhava de três críticos e a tela
  // dizia "Bom de fechar" para quem perdia 42% por preço e tinha metade da
  // carteira esfriando.
  it("sai do sinal mais GRAVE, não do primeiro da lista", () => {
    const d = analisarVendedor(f({
      criadas: 47, meses: 12, chegaramProposta: 19, chegaramNegociacao: 9, faturadas: 5,
      perdidas: 12, perdidasPorMotivo: { preco: 5, credito: 4, sem_retorno: 2, adiou: 1 },
      abertas: 30, abertasParadas: 16,
      mensagensEnviadas: 120, mensagensComPergunta: 10,
      visitasRealizadas: 38,
    }));
    expect(d.sinais.find((s) => s.id === "entrada")?.gravidade).toBe("atencao");
    expect(d.sinais.find((s) => s.id === "motivo:preco")?.gravidade).toBe("critico");
    expect(d.perfil.titulo).toBe("Vende máquina, ainda não vende conta");
    expect(d.perfil.titulo).not.toBe("Bom de fechar, curto de topo");
  });

  it("quem só tem topo magro é que leva o rótulo de topo magro", () => {
    const d = analisarVendedor(f({
      criadas: 12, meses: 12, chegaramProposta: 10, chegaramNegociacao: 8, faturadas: 6,
      perdidas: 2, perdidasPorMotivo: { preco: 2 }, abertas: 4, abertasParadas: 0,
      mensagensEnviadas: 100, mensagensComPergunta: 40, visitasRealizadas: 20,
    }));
    expect(d.perfil.titulo).toBe("Bom de fechar, curto de topo");
  });

  it("crédito derrubando as vendas vira 'qualifica tarde'", () => {
    const d = analisarVendedor(f({
      criadas: 40, meses: 12, chegaramProposta: 30, chegaramNegociacao: 20, faturadas: 8,
      perdidas: 10, perdidasPorMotivo: { credito: 7, outro: 3 },
      abertas: 10, abertasParadas: 0, mensagensEnviadas: 100, mensagensComPergunta: 40,
    }));
    expect(d.perfil.titulo).toBe("Qualifica tarde");
  });

  it("sem vazamento nenhum, não inventa defeito", () => {
    const d = analisarVendedor(f({
      criadas: 60, meses: 12, chegaramProposta: 50, chegaramNegociacao: 30, faturadas: 18,
      perdidas: 5, perdidasPorMotivo: { outro: 5 }, abertas: 10, abertasParadas: 0,
      mensagensEnviadas: 200, mensagensComPergunta: 90, visitasRealizadas: 60,
    }));
    expect(["Consistente", "Equilibrado, sem vazamento claro"]).toContain(d.perfil.titulo);
  });
});

describe("sem dados", () => {
  it("não inventa perfil para quem quase não tem negociação", () => {
    const d = analisarVendedor(f({
      criadas: 2, chegaramProposta: 1, chegaramNegociacao: 0, faturadas: 0,
      perdidas: 1, perdidasPorMotivo: { preco: 1 }, abertas: 1, abertasParadas: 0,
      mensagensEnviadas: 3, mensagensComPergunta: 0, visitasRealizadas: 0, meses: 12,
    }));
    expect(d.poucosDados).toBe(true);
    expect(d.perfil.titulo).toBe("Ainda sem retrato");
    expect(d.gargalo).toBeNull();
    expect(d.taxaGeral).toBeNull();
  });
});

// ── A contagem que vem do banco: as duas regras que mais erram sozinhas ─────
import { nivelAlcancado, temPergunta } from "@/lib/orientador-vendedor-dados";

describe("até onde a negociação chegou", () => {
  it("faturada passou por todas as fases, mesmo pulando o quadro", () => {
    expect(nivelAlcancado("em_negociacao", "ganha")).toBe(4);
    expect(nivelAlcancado("outro", "ganha")).toBe(4);
  });
  it("quem está em negociação já passou por proposta", () => {
    expect(nivelAlcancado("negociacao", "aberta")).toBe(3);
    expect(nivelAlcancado("banco", "aberta")).toBe(2);
    expect(nivelAlcancado("em_negociacao", "aberta")).toBe(1);
  });
  it("perdida com estágio na coluna de perda conta como oportunidade, não como avanço", () => {
    // O estágio dela vira VENDA PERDIDA e não diz onde morreu: preferir o
    // número menor mantém a taxa honesta.
    expect(nivelAlcancado("perdida", "perdida")).toBe(1);
    expect(nivelAlcancado("outro", "perdida")).toBe(1);
  });
});

describe("o que conta como pergunta", () => {
  it("pergunta de diagnóstico conta", () => {
    expect(temPergunta("Qual a hora de máquina que você roda por mês?")).toBe(true);
  });
  it("mensagem sem interrogação não conta", () => {
    expect(temPergunta("Segue a proposta em anexo.")).toBe(false);
  });
  it("interrogação solta não é pergunta", () => {
    expect(temPergunta("?")).toBe(false);
    expect(temPergunta("??")).toBe(false);
    expect(temPergunta("oi?")).toBe(false);
  });
});
