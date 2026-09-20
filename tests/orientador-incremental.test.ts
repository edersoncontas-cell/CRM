// Ideia do vendedor, e é a arquitetura certa:
//
//   "se você configurar para que a IA atualize o contexto baseado na última
//    conversa mantendo o que já está preenchido, ao invés do contexto da
//    conversa toda, conseguimos resolver essa questão?"
//
// Sim. O pedido cai de ~5.515 para ~2.800 tokens — metade do teto por minuto
// da camada gratuita, com folga. E há um segundo ganho: o estado acumulado
// PRESERVA O COMEÇO da conversa, que a janela cortada vinha jogando fora
// justamente onde mora a qualificação.
//
// O RISCO É A DERIVA, e é ele que estes testes guardam. No incremental nada
// relê a fonte: se um campo certo for esvaziado, ele some do estado e NUNCA
// MAIS VOLTA, porque a próxima análise parte deste estado já empobrecido. A
// degradação seria silenciosa e cumulativa — o pior tipo.
//
// Por isso a mesclagem existe em CÓDIGO, e não só como pedido no prompt.

import { describe, it, expect } from "vitest";
import {
  podeSerIncremental, mesclarIncremental, estadoDaAnalise, montarPromptIncremental,
  LIMITE_INCREMENTAIS,
} from "@/lib/zeus/orientador-incremental";
import { coachingVazio } from "@/lib/zeus/orientador-coaching";
import { FATOS_VAZIOS } from "@/lib/orientador-fatos";
import type { AnaliseOrientador } from "@/lib/zeus/orientador";

const base = (over: Partial<AnaliseOrientador> = {}): AnaliseOrientador => ({
  resumoNegociacao: "Quer a E145C por R$ 610.000 financiada.",
  estagioVenda: "Proposta",
  perfilComprador: "Técnico",
  objecoes: ["Preço"],
  probabilidadeFechamento: 55,
  probabilidadeExplicacao: "pediu proposta e citou prazo",
  temperatura: "quente",
  proximaAcao: "Ligar segunda 23/09",
  oportunidadesPerdidas: ["não pediu a visita"],
  combinados: ["Proposta enviada"],
  pendencias: ["Cliente: confirmar entrada"],
  coaching: coachingVazio(),
  alertas: [],
  conversaEncerrada: false,
  fatos: { ...FATOS_VAZIOS, marca: "New Holland", maquinaModelo: "E145C", valor: 610000, condicaoPagamento: "financiamento", entradaPercentual: 10 },
  pedidos: [],
  ...over,
});

describe("quando o incremental pode acontecer", () => {
  const ok = { temEstadoAnterior: true, mensagensNovas: 3, incrementaisSeguidas: 0, forcarCompleta: false };

  it("com estado anterior e mensagem nova, pode", () => {
    expect(podeSerIncremental(ok)).toBe(true);
  });

  it("sem análise anterior, NÃO — não há o que atualizar", () => {
    expect(podeSerIncremental({ ...ok, temEstadoAnterior: false })).toBe(false);
  });

  it("sem mensagem nova, NÃO — não há o que acrescentar", () => {
    expect(podeSerIncremental({ ...ok, mensagensNovas: 0 })).toBe(false);
  });

  it('"Reanalisar" na mão SEMPRE relê tudo', () => {
    // É o botão de "esqueça o que você achou e olhe de novo". Um incremental
    // partindo da leitura errada não teria como consertá-la.
    expect(podeSerIncremental({ ...ok, forcarCompleta: true })).toBe(false);
  });

  it("a cada 10 incrementais seguidas, uma releitura completa — a trava da deriva", () => {
    expect(podeSerIncremental({ ...ok, incrementaisSeguidas: LIMITE_INCREMENTAIS - 1 })).toBe(true);
    expect(podeSerIncremental({ ...ok, incrementaisSeguidas: LIMITE_INCREMENTAIS })).toBe(false);
    expect(podeSerIncremental({ ...ok, incrementaisSeguidas: 50 })).toBe(false);
  });
});

describe("a mesclagem NUNCA perde o que já estava preenchido", () => {
  // Este bloco é o coração da coisa. "mantendo o que já está preenchido" foi
  // exatamente o pedido, e é o que impede a degradação cumulativa.
  const anterior = base();

  it("campo esvaziado pelo modelo volta ao valor anterior", () => {
    const novo = base({ resumoNegociacao: "", proximaAcao: "" });
    const m = mesclarIncremental(anterior, novo);
    expect(m.resumoNegociacao).toBe(anterior.resumoNegociacao);
    expect(m.proximaAcao).toBe(anterior.proximaAcao);
  });

  it("fato esvaziado volta — máquina, valor, pagamento e entrada", () => {
    const novo = base({ fatos: { ...FATOS_VAZIOS } });
    const m = mesclarIncremental(anterior, novo);
    expect(m.fatos.maquinaModelo).toBe("E145C");
    expect(m.fatos.marca).toBe("New Holland");
    expect(m.fatos.valor).toBe(610000);
    expect(m.fatos.condicaoPagamento).toBe("financiamento");
    expect(m.fatos.entradaPercentual).toBe(10);
  });

  it("listas esvaziadas voltam", () => {
    const novo = base({ objecoes: [], combinados: [], pendencias: [], oportunidadesPerdidas: [] });
    const m = mesclarIncremental(anterior, novo);
    expect(m.objecoes).toEqual(["Preço"]);
    expect(m.combinados).toEqual(["Proposta enviada"]);
    expect(m.pendencias).toEqual(["Cliente: confirmar entrada"]);
  });

  it("valor ZERO conta como vazio — é o jeito favorito do modelo de apagar número", () => {
    const novo = base({ fatos: { ...FATOS_VAZIOS, valor: 0, entradaPercentual: 0 } });
    const m = mesclarIncremental(anterior, novo);
    expect(m.fatos.valor).toBe(610000);
    expect(m.fatos.entradaPercentual).toBe(10);
  });

  it("o coaching anterior é preservado — ele nem vem no contrato do incremental", () => {
    const m = mesclarIncremental(base({ coaching: { ...coachingVazio(), roteiro: [{ etapa: "Visita", status: "feito", dica: "x" }] } }), base());
    expect(m.coaching.roteiro).toHaveLength(1);
  });
});

describe("a mesclagem ACEITA o que de fato mudou", () => {
  const anterior = base();

  it("valor novo substitui o antigo", () => {
    const novo = base({ fatos: { ...anterior.fatos, valor: 600000 } });
    expect(mesclarIncremental(anterior, novo).fatos.valor).toBe(600000);
  });

  it("máquina trocada é respeitada", () => {
    const novo = base({ fatos: { ...anterior.fatos, maquinaModelo: "B110" } });
    expect(mesclarIncremental(anterior, novo).fatos.maquinaModelo).toBe("B110");
  });

  it("resumo e próxima ação novos ganham", () => {
    const novo = base({ resumoNegociacao: "Fechou em 600 mil.", proximaAcao: "Emitir a proposta hoje" });
    const m = mesclarIncremental(anterior, novo);
    expect(m.resumoNegociacao).toBe("Fechou em 600 mil.");
    expect(m.proximaAcao).toBe("Emitir a proposta hoje");
  });

  it("estágio, temperatura e probabilidade seguem o novo", () => {
    const novo = base({ estagioVenda: "Fechamento", temperatura: "muito_quente", probabilidadeFechamento: 80 });
    const m = mesclarIncremental(anterior, novo);
    expect(m.estagioVenda).toBe("Fechamento");
    expect(m.temperatura).toBe("muito_quente");
    expect(m.probabilidadeFechamento).toBe(80);
  });

  it("pedidos e alertas vêm do novo — são sobre o momento, não acumulam", () => {
    const novo = base({ pedidos: [{ tipo: "vincular_cliente", alvo: "BWB", motivo: "x" }] });
    expect(mesclarIncremental(anterior, novo).pedidos).toHaveLength(1);
    expect(mesclarIncremental(base({ alertas: ["antigo"] }), base({ alertas: [] })).alertas).toEqual([]);
  });
});

describe("o estado que vai no prompt", () => {
  const a = { resumoNegociacao: "Quer a E145C.", estagioVenda: "Proposta", temperatura: "quente", probabilidadeFechamento: 55, proximaAcao: "Ligar segunda" };
  const neg = { marca: "New Holland", maquinaModelo: "E145C", valor: 610000, tipoPagamento: "financiamento", entradaValor: null, entradaPercentual: 10, observacao: "braço longo" };

  it("junta marca e modelo numa linha só", () => {
    expect(estadoDaAnalise(a, neg, "Guaçuí", true).maquina).toBe("New Holland E145C");
  });

  it("a entrada sai como o vendedor fala", () => {
    expect(estadoDaAnalise(a, neg, null, null).entrada).toBe("10%");
    expect(estadoDaAnalise(a, { ...neg, entradaPercentual: null, entradaValor: 180000 }, null, null).entrada).toBe("R$ 180.000");
  });

  it("sem negociação aberta, os campos ficam null em vez de quebrar", () => {
    const e = estadoDaAnalise(a, null, null, null);
    expect(e.maquina).toBe(null);
    expect(e.valor).toBe(null);
    expect(e.resumoNegociacao).toBe("Quer a E145C.");
  });
});

describe("o prompt do incremental", () => {
  const { system, user } = montarPromptIncremental({
    estado: estadoDaAnalise(
      { resumoNegociacao: "Quer a E145C.", estagioVenda: "Proposta", temperatura: "quente", probabilidadeFechamento: 55, proximaAcao: "Ligar segunda" },
      { marca: "New Holland", maquinaModelo: "E145C", valor: 610000, tipoPagamento: "financiamento", entradaValor: null, entradaPercentual: 10, observacao: null },
      "Guaçuí", null),
    mensagensNovas: "CLIENTE: consegue 600?",
    contextoCliente: "Wadson Pires Ratinho",
    notaVendedor: "Entrada 10%",
  });

  it("manda MANTER o que já está preenchido — o pedido do vendedor, em maiúsculas", () => {
    expect(system).toMatch(/MANTENHA tudo o que já está preenchido/);
    expect(system).toMatch(/Nunca devolva null/);
  });

  it("proíbe esvaziar campo por falta de menção", () => {
    expect(system).toMatch(/CONTINUA COMO ESTÁ/);
  });

  it("o estado anterior vai inteiro, em JSON", () => {
    expect(user).toContain("ESTADO ATUAL DA NEGOCIAÇÃO");
    expect(user).toContain("New Holland E145C");
    expect(user).toContain("610000");
    expect(user).toContain("Guaçuí");
  });

  it("só as mensagens NOVAS vão junto — é daí que vem a economia", () => {
    expect(user).toContain("consegue 600?");
    expect(user).toContain("MENSAGENS NOVAS");
  });

  it("a nota do vendedor abre a mensagem, antes do estado", () => {
    expect(user.indexOf("Entrada 10%")).toBeLessThan(user.indexOf("ESTADO ATUAL"));
  });

  it("as regras contra invenção continuam valendo no incremental", () => {
    expect(system).toMatch(/NUNCA invente/);
    expect(system).toMatch(/ESCAVADEIRA/);
    expect(system).toMatch(/Nome de empresa é rótulo/);
  });

  it("o pedido é MUITO menor que a conversa inteira", () => {
    // É o ponto de tudo: ~2.800 tokens contra ~5.515.
    expect((system.length + user.length) / 4).toBeLessThan(2_000);
  });
});
