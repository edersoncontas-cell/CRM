import { describe, it, expect } from "vitest";
import { ETAPAS, ETAPAS_POR_ID, tamanhoDoGuia, ROTULO_CANAL } from "@/lib/academia/etapas";
import {
  CENARIOS, CENARIOS_POR_ID, cenariosIniciais, cenariosDaEtapa, pontuacao, veredito, PONTOS,
} from "@/lib/academia/simulador";

describe("guia das etapas da venda", () => {
  it("cobre a venda inteira, da prospecção ao pós-venda", () => {
    const ids = ETAPAS.map((e) => e.id);
    for (const esperado of ["prospeccao", "qualificacao", "visita", "proposta", "objecoes", "fechamento", "posvenda"]) {
      expect(ids).toContain(esperado);
    }
  });

  it("cada etapa diz o que fazer, o que identificar, o que perguntar, o que falar e o que responder", () => {
    for (const e of ETAPAS) {
      expect(e.objetivo.length, e.id).toBeGreaterThan(20);
      expect(e.oQueFazer.length, e.id).toBeGreaterThanOrEqual(4);
      expect(e.oQueIdentificar.length, e.id).toBeGreaterThanOrEqual(3);
      expect(e.perguntas.length, e.id).toBeGreaterThanOrEqual(3);
      expect(e.falas.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.respostas.length, e.id).toBeGreaterThanOrEqual(1);
      expect(e.erros.length, e.id).toBeGreaterThanOrEqual(3);
      expect(e.criteriosDeAvanco.length, e.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("toda fala de exemplo tem canal conhecido e explicação do porquê", () => {
    for (const e of ETAPAS) {
      for (const f of e.falas) {
        expect(Object.keys(ROTULO_CANAL)).toContain(f.canal);
        expect(f.fala.length).toBeGreaterThan(30);
        expect(f.porque.length).toBeGreaterThan(20);
      }
    }
  });

  it("cada sinal de leitura vem com significado e ação", () => {
    for (const e of ETAPAS) {
      for (const s of e.oQueIdentificar) {
        expect(s.significa.length, `${e.id}/${s.sinal}`).toBeGreaterThan(10);
        expect(s.acao.length, `${e.id}/${s.sinal}`).toBeGreaterThan(10);
      }
    }
  });

  it("a prospecção cobre os quatro jeitos de o contato acontecer", () => {
    const canais = new Set(ETAPAS_POR_ID.get("prospeccao")!.falas.map((f) => f.canal));
    expect(canais).toEqual(new Set(["mensagem", "telefone", "presencial", "recebido"]));
  });

  it("o guia é grande de verdade", () => {
    const t = tamanhoDoGuia();
    expect(t.etapas).toBeGreaterThanOrEqual(7);
    expect(t.itens).toBeGreaterThan(100);
    expect(t.falas).toBeGreaterThan(15);
  });
});

describe("simulador", () => {
  it("todo cenário tem opções com feedback e leva a algum lugar", () => {
    for (const c of CENARIOS) {
      expect(c.opcoes.length, c.id).toBeGreaterThanOrEqual(2);
      for (const o of c.opcoes) {
        expect(o.feedback.length, `${c.id}/${o.id}`).toBeGreaterThan(30);
        expect(o.proximo || c.desfecho || o.qualidade, `${c.id}/${o.id}`).toBeTruthy();
        // ou encadeia, ou termina a história
        expect(Boolean(o.proximo) || Boolean(o.feedback), `${c.id}/${o.id}`).toBe(true);
      }
    }
  });

  it("todo encadeamento aponta para um cenário que existe", () => {
    for (const c of CENARIOS) {
      for (const o of c.opcoes) {
        if (o.proximo) expect(CENARIOS_POR_ID.has(o.proximo), `${c.id} → ${o.proximo}`).toBe(true);
      }
    }
  });

  it("cada cenário tem pelo menos uma escolha boa", () => {
    for (const c of CENARIOS) {
      expect(c.opcoes.some((o) => o.qualidade === "boa"), c.id).toBe(true);
    }
  });

  it("existem trilhas para começar e caminhos que terminam em ganhar e em perder", () => {
    expect(cenariosIniciais().length).toBeGreaterThanOrEqual(3);
    const tipos = new Set(
      CENARIOS.flatMap((c) => [c.desfecho?.tipo, ...c.opcoes.map((o) => o.desfecho?.tipo)]).filter(Boolean),
    );
    expect(tipos.has("ganhou")).toBe(true);
    expect(tipos.has("perdeu")).toBe(true);
    expect(tipos.has("travou")).toBe(true);
  });

  it("o simulador cobre a etapa do cliente que só quer preço", () => {
    expect(cenariosDaEtapa("qualificacao").length).toBeGreaterThan(0);
    expect(CENARIOS_POR_ID.get("preco-1")?.titulo).toMatch(/preço/i);
  });

  it("a pontuação soma pelas escolhas", () => {
    const boas = CENARIOS.slice(0, 3).map((c) => ({ cenarioId: c.id, opcaoId: c.opcoes.find((o) => o.qualidade === "boa")!.id }));
    const r = pontuacao(boas);
    expect(r.pontos).toBe(3 * PONTOS.boa);
    expect(r.percentual).toBe(100);
  });

  it("o veredito muda conforme o resultado", () => {
    expect(veredito(90, { tipo: "ganhou", texto: "" })).toMatch(/padrão/i);
    expect(veredito(40, { tipo: "perdeu", texto: "" })).toMatch(/Perdeu/);
    expect(veredito(30)).toMatch(/Qualificação/);
  });
});
