import { describe, it, expect } from "vitest";
import {
  TRILHA, TODAS_AULAS, embaralharOpcoes, atualizarRevisao, selecionarRevisao, resumoRevisao, montarCertificacao, certificacaoLiberada,
  idPergunta, perguntaPorId, INTERVALOS_REVISAO_DIAS, PERGUNTAS_CERTIFICACAO, type EstadoRevisao,
} from "../src/lib/academia-trilha";

// ─────────────────────────────────────────────────────────────────────────
// Qualidade do currículo — o que barra quiz preguiçoso e conteúdo raso.
// ─────────────────────────────────────────────────────────────────────────
describe("trilha: estrutura do currículo", () => {
  it("10 módulos em ordem, com 6 aulas cada, ids únicos", () => {
    expect(TRILHA).toHaveLength(10);
    TRILHA.forEach((m, i) => expect(m.nivel).toBe(i + 1));
    for (const m of TRILHA) expect(m.aulas.length).toBeGreaterThanOrEqual(6);
    const ids = TODAS_AULAS.map((a) => a.aula.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(TRILHA.map((m) => m.id)).size).toBe(10);
  });

  it("cada módulo tem objetivos, leituras e prova final com pelo menos 12 perguntas", () => {
    for (const m of TRILHA) {
      expect(m.objetivos.length, m.id).toBeGreaterThanOrEqual(5);
      expect(m.leituras.length, m.id).toBeGreaterThanOrEqual(3);
      expect(m.prova.length, m.id).toBeGreaterThanOrEqual(12);
    }
  });

  it("cada aula é profunda: 8+ blocos, framework ou conta ou diálogo, caso, missão e quiz de 5", () => {
    for (const { modulo, aula } of TODAS_AULAS) {
      const rot = `${modulo.id}/${aula.id}`;
      expect(aula.blocos.length, rot).toBeGreaterThanOrEqual(8);
      const tipos = new Set(aula.blocos.map((b) => b.tipo));
      expect(tipos.has("framework") || tipos.has("conta") || tipos.has("dialogo"), `${rot}: sem framework/conta/diálogo`).toBe(true);
      expect(tipos.has("caso") || tipos.has("dialogo"), `${rot}: sem caso nem diálogo`).toBe(true);
      expect(aula.missao.length, rot).toBeGreaterThan(60);
      expect(aula.quiz.length, rot).toBeGreaterThanOrEqual(5);
      expect(aula.minutos, rot).toBeGreaterThanOrEqual(10);
    }
  });

  it("toda pergunta tem 4 opções distintas, uma certa válida e explicação de verdade", () => {
    const todas = [
      ...TODAS_AULAS.flatMap(({ aula }) => aula.quiz.map((q) => ({ q, onde: aula.id }))),
      ...TRILHA.flatMap((m) => m.prova.map((q) => ({ q, onde: `${m.id}/prova` }))),
    ];
    expect(todas.length).toBeGreaterThanOrEqual(400);
    for (const { q, onde } of todas) {
      expect(q.opcoes.length, onde).toBe(4);
      expect(new Set(q.opcoes).size, onde).toBe(4);
      expect(q.correta, onde).toBeGreaterThanOrEqual(0);
      expect(q.correta, onde).toBeLessThan(4);
      expect(q.explicacao.length, `${onde}: explicação curta`).toBeGreaterThanOrEqual(60);
      expect(q.pergunta.length, onde).toBeGreaterThanOrEqual(30);
    }
  });

  it("a posição da resposta certa é distribuída (nenhuma posição passa de 40%)", () => {
    const contagem = [0, 0, 0, 0];
    let total = 0;
    for (const { aula } of TODAS_AULAS) for (const q of aula.quiz) { contagem[q.correta]++; total++; }
    for (const m of TRILHA) for (const q of m.prova) { contagem[q.correta]++; total++; }
    for (const c of contagem) expect(c / total).toBeLessThan(0.4);
    for (const c of contagem) expect(c / total).toBeGreaterThan(0.12);
  });

  it("as opções erradas não são caricatas: nenhuma opção com menos de 12 caracteres", () => {
    for (const { aula } of TODAS_AULAS) for (const q of aula.quiz) for (const o of q.opcoes) expect(o.length, `${aula.id}: "${o}"`).toBeGreaterThanOrEqual(12);
  });

  it("a resposta certa não se entrega pelo tamanho: comprimento parecido com o das erradas", () => {
    const todas = [
      ...TODAS_AULAS.flatMap(({ aula }) => aula.quiz.map((q) => ({ q, onde: aula.id }))),
      ...TRILHA.flatMap((m) => m.prova.map((q) => ({ q, onde: `${m.id}/prova` }))),
    ];
    let soma = 0;
    for (const { q, onde } of todas) {
      const erradas = q.opcoes.filter((_, i) => i !== q.correta);
      const media = erradas.reduce((s, o) => s + o.length, 0) / erradas.length;
      const razao = q.opcoes[q.correta].length / media;
      expect(razao, `${onde}: certa muito mais longa que as erradas`).toBeLessThan(1.35);
      soma += razao;
    }
    const media = soma / todas.length;
    expect(media).toBeGreaterThan(0.85);
    expect(media).toBeLessThan(1.15);
  });

  it("nenhuma pergunta se repete entre aulas e provas", () => {
    const vistas = new Set<string>();
    const todas = [...TODAS_AULAS.flatMap(({ aula }) => aula.quiz), ...TRILHA.flatMap((m) => m.prova)];
    for (const q of todas) {
      const k = q.pergunta.trim().toLowerCase();
      expect(vistas.has(k), `pergunta repetida: ${q.pergunta}`).toBe(false);
      vistas.add(k);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Motor
// ─────────────────────────────────────────────────────────────────────────
describe("trilha: embaralhar opções", () => {
  const q = { pergunta: "Qual é a pergunta?", opcoes: ["a", "b", "c", "d"], correta: 2, explicacao: "x" };
  it("mantém as 4 opções, aponta a certa na nova posição e muda com a semente", () => {
    const e1 = embaralharOpcoes(q, 1);
    expect([...e1.opcoes].sort()).toEqual(["a", "b", "c", "d"]);
    expect(e1.opcoes[e1.correta]).toBe("c");
    expect(e1.ordem[e1.correta]).toBe(2);
    const posicoes = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => embaralharOpcoes(q, s).correta));
    expect(posicoes.size).toBeGreaterThan(1);
  });
  it("é determinístico para a mesma semente", () => {
    expect(embaralharOpcoes(q, 42)).toEqual(embaralharOpcoes(q, 42));
  });
});

describe("trilha: revisão espaçada", () => {
  const hoje = new Date("2026-09-18T12:00:00Z");
  const dia = 86_400_000;
  it("acertos seguidos afastam a pergunta: 1, 3, 7, 14, 30 dias; erro traz de volta amanhã", () => {
    let e: EstadoRevisao = {};
    for (let i = 0; i < INTERVALOS_REVISAO_DIAS.length; i++) {
      e = atualizarRevisao(e, "m1a1#0", true, hoje);
      const dias = Math.round((new Date(e["m1a1#0"].proxima).getTime() - hoje.getTime()) / dia);
      expect(dias).toBe(INTERVALOS_REVISAO_DIAS[i]);
    }
    e = atualizarRevisao(e, "m1a1#0", false, hoje);
    expect(e["m1a1#0"].sequencia).toBe(0);
    expect(Math.round((new Date(e["m1a1#0"].proxima).getTime() - hoje.getTime()) / dia)).toBe(1);
    expect(e["m1a1#0"].erros).toBe(1);
    expect(e["m1a1#0"].acertos).toBe(INTERVALOS_REVISAO_DIAS.length);
  });

  it("só revisa aulas concluídas; vencidas vêm antes das novas; erradas na frente", () => {
    const a1 = TODAS_AULAS[0].aula, a2 = TODAS_AULAS[1].aula;
    const concluidas = new Set([a1.id, a2.id]);
    expect(selecionarRevisao(new Set(), {}, hoje, 10)).toEqual([]);
    const ontem = new Date(hoje.getTime() - dia).toISOString();
    const estado: EstadoRevisao = {
      [idPergunta(a1.id, 0)]: { acertos: 3, erros: 0, sequencia: 3, proxima: ontem },
      [idPergunta(a1.id, 1)]: { acertos: 0, erros: 2, sequencia: 0, proxima: ontem },
      [idPergunta(a1.id, 2)]: { acertos: 1, erros: 0, sequencia: 1, proxima: new Date(hoje.getTime() + 5 * dia).toISOString() },
    };
    const sessao = selecionarRevisao(concluidas, estado, hoje, 4);
    expect(sessao[0]).toBe(idPergunta(a1.id, 1)); // mais errada primeiro
    expect(sessao[1]).toBe(idPergunta(a1.id, 0));
    expect(sessao).not.toContain(idPergunta(a1.id, 2)); // ainda não venceu
    expect(sessao.length).toBe(4);
    // novas espalhadas: a terceira vem de a1 e a quarta de a2 (ou vice-versa), não duas da mesma aula
    expect(new Set(sessao.slice(2).map((id) => id.split("#")[0])).size).toBe(2);
    const r = resumoRevisao(concluidas, estado, hoje);
    expect(r.vencidas).toBe(2);
    expect(r.dominadas).toBe(0);
    expect(r.novas).toBe(a1.quiz.length + a2.quiz.length - 3);
  });

  it("perguntaPorId volta a pergunta certa", () => {
    const a = TODAS_AULAS[0].aula;
    expect(perguntaPorId(idPergunta(a.id, 1))?.pergunta).toBe(a.quiz[1]);
    expect(perguntaPorId("nada#9")).toBeNull();
  });
});

describe("trilha: certificação final", () => {
  it("40 perguntas, 4 por módulo, sorteio muda com a semente e só libera com os 10 certificados", () => {
    const p = montarCertificacao(1);
    expect(p).toHaveLength(PERGUNTAS_CERTIFICACAO);
    for (const m of TRILHA) expect(p.filter((x) => x.modulo.id === m.id)).toHaveLength(4);
    expect(new Set(p.map((x) => x.pergunta.pergunta)).size).toBe(PERGUNTAS_CERTIFICACAO);
    const outra = montarCertificacao(2).map((x) => x.pergunta.pergunta).join("|");
    expect(outra).not.toBe(p.map((x) => x.pergunta.pergunta).join("|"));
    const todas = new Set(TODAS_AULAS.map((a) => a.aula.id));
    const provas = Object.fromEntries(TRILHA.map((m) => [m.id, 80]));
    expect(certificacaoLiberada(todas, provas)).toBe(true);
    expect(certificacaoLiberada(todas, { ...provas, m3: 50 })).toBe(false);
  });
});
